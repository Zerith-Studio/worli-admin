// ============================================
// FILE: hooks/usePaginatedQuery.js
// Server-side windowed loading for every list in the panel. Lists APPEND: the
// first batch loads, and scrolling to the bottom fetches and adds the next.
//
// This exists because six call sites each hand-rolled the same page state,
// from/to arithmetic, exact-count fetch, timeout wrapper and mount guard — and
// drifted. Three of them ended up silently capped at their first page because
// the page forgot to render the controls the hook was exporting; one paged with
// a 0-based index while the rest were 1-based; and the page sizes had diverged
// to 12/15/20. Centralising it makes "the list is truncated and nobody noticed"
// not a thing a page can do by accident.
// ============================================

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"
import { withTimeout } from "../lib/query"
import { useRowsPerLoad } from "../lib/rows-per-load"

/**
 * Return this from `prepare` or `applyFilters` when the filters make a match
 * impossible (e.g. a customer search that matched no users). Skips the round
 * trip and yields an honest empty list instead of an unfiltered one.
 */
export const NO_MATCHES = Symbol("no-matches")

/**
 * @param {object}   opts
 * @param {string}   opts.table        Table (or view) to select from.
 * @param {string}   opts.select       PostgREST select string.
 * @param {number}   [opts.pageSize]   Rows per batch. Defaults to the panel-wide
 *                                     preference from the Rows selector.
 * @param {object}   [opts.initialFilters]
 * @param {function} [opts.prepare]    async (filters) => data | NO_MATCHES.
 *   Async work needed BEFORE the query is built — in practice, resolving a
 *   customer-name search to user ids, because PostgREST can't ilike an embedded
 *   table's column. Whatever it returns is handed to applyFilters as
 *   `prepared`. It MUST return plain data, never a query builder (see below).
 * @param {function} [opts.applyFilters]  (query, filters, prepared) => query | NO_MATCHES.
 *   MUST BE SYNCHRONOUS. Supabase query builders are *thenable*, so returning
 *   one from an `async` function makes the promise machinery adopt it — which
 *   executes the query and resolves with a `{data, error, count}` response
 *   instead of the builder. The symptom is a baffling "query.range is not a
 *   function" several lines later. That is why async work lives in `prepare`,
 *   whose result is plain data and therefore safe to await.
 * @param {object|object[]} [opts.orderBy]  {column, ascending} — applied in order.
 *   A unique tiebreaker (`tiebreak`) is always appended, so do not add one here.
 * @param {string}   [opts.tiebreak]  Unique column that makes the sort total.
 *   Defaults to "id". Pass null ONLY for a source with no unique column, and
 *   understand that windows over it will not be stable.
 * @param {function} [opts.transform]   (rows) => rows, mapping DB shape to UI
 *                                     shape. May be async — it returns an array,
 *                                     which is not thenable, so it's safe.
 * @param {function} [opts.getRowId]   Row identity, for de-duplicating appended
 *                                     batches. Defaults to `row.id`.
 * @param {boolean}  [opts.enabled]     Skip fetching while false.
 */
export function usePaginatedQuery({
  table,
  select,
  pageSize,
  initialFilters = {},
  prepare,
  applyFilters,
  orderBy = { column: "created_at", ascending: false },
  tiebreak = "id",
  transform,
  getRowId = (row) => row?.id,
  enabled = true,
}) {
  const globalRowsPerLoad = useRowsPerLoad()
  const batchSize = pageSize ?? globalRowsPerLoad

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState(initialFilters)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Held in refs so callers can pass inline arrows without re-triggering the
  // fetch on every render.
  const applyFiltersRef = useRef(applyFilters)
  const prepareRef = useRef(prepare)
  const transformRef = useRef(transform)
  const orderByRef = useRef(orderBy)
  const getRowIdRef = useRef(getRowId)
  applyFiltersRef.current = applyFilters
  prepareRef.current = prepare
  transformRef.current = transform
  orderByRef.current = orderBy
  getRowIdRef.current = getRowId

  // orderBy is read from a ref (call sites pass an inline object literal, which
  // would be a new identity every render and loop forever in the deps array),
  // but it also legitimately CHANGES when a page has sort controls — so the
  // effect keys on its value rather than its identity.
  const orderKey = JSON.stringify([orderBy].flat())

  // Guards against a slow response overwriting a newer one. Filters change
  // faster than queries return — type into a search box and several are in
  // flight at once — and without this the LAST response to arrive wins
  // regardless of which query it answered, leaving the table showing results
  // for a search the user has already moved on from.
  const generationRef = useRef(0)

  // How many rows are loaded, tracked outside React state so loadMore can read
  // it without being re-created (and re-triggering the scroll observer) on
  // every batch.
  const loadedRef = useRef(0)

  /**
   * @param {number} from   First row index to request.
   * @param {number} to     Last row index to request (inclusive).
   * @param {"replace"|"append"} mode
   */
  const fetchWindow = useCallback(
    async (from, to, mode, isBackground = false) => {
      if (!enabled) {
        setLoading(false)
        return
      }
      const generation = ++generationRef.current
      const isAppend = mode === "append"
      try {
        if (isAppend) setLoadingMore(true)
        else if (!isBackground) setLoading(true)
        setError(null)

        const emptyList = () => {
          if (mountedRef.current && generation === generationRef.current) {
            setRows([])
            setTotalCount(0)
            loadedRef.current = 0
          }
        }

        // Async prep happens BEFORE the builder exists, so there is never a
        // builder in flight through an await. See the `prepare` docs above.
        let prepared
        if (prepareRef.current) {
          prepared = await prepareRef.current(filters)
          if (prepared === NO_MATCHES) return emptyList()
          if (!mountedRef.current || generation !== generationRef.current) return
        }

        let query = supabase.from(table).select(select, { count: "exact" })

        if (applyFiltersRef.current) {
          // Deliberately not awaited — applyFilters is synchronous by contract.
          const built = applyFiltersRef.current(query, filters, prepared)
          if (built === NO_MATCHES) return emptyList()
          query = built ?? query
          if (typeof query?.range !== "function") {
            // Almost always an `async applyFilters` returning the builder: the
            // promise adopted the thenable, ran the query, and handed back a
            // response object. Say so, rather than let it surface as
            // "query.range is not a function" from the next line.
            throw new Error(
              `usePaginatedQuery(${table}): applyFilters must be synchronous and return the query builder. ` +
                `Move any await into \`prepare\`.`
            )
          }
        }

        query = query.range(from, to)

        for (const o of [orderByRef.current].flat().filter(Boolean)) {
          query = query.order(o.column, { ascending: o.ascending ?? false })
        }

        // A unique tiebreaker, so the sort is a TOTAL order.
        //
        // Without one, offset windows are not stable. Rows sorted only by
        // created_at tie constantly — a night's orders are all generated by the
        // same cron run, within milliseconds — and Postgres is free to return
        // tied rows in any order it likes, differently per query. Batch 2 then
        // re-sends some rows batch 1 already had (caught by the dedupe below)
        // and, worse, silently SKIPS others: they are simply never rendered,
        // and `rows.length` never reaches `totalCount`, so the scroll loader
        // keeps firing forever on a list that can never finish.
        if (tiebreak) query = query.order(tiebreak, { ascending: true })

        const { data, error: fetchError, count } = await withTimeout(query)
        if (fetchError) throw fetchError
        if (!mountedRef.current || generation !== generationRef.current) return

        const mapped = transformRef.current
          ? await transformRef.current(data ?? [])
          : (data ?? [])
        // transform may await (Storage lookups), so re-check afterwards.
        if (!mountedRef.current || generation !== generationRef.current) return

        setTotalCount(count ?? 0)
        if (isAppend) {
          setRows((prev) => {
            // De-duplicate by id. Offset windows are not stable: if a row is
            // inserted above while you are reading, everything shifts down by
            // one and the next batch re-sends a row you already have. Without
            // this that shows up as a duplicated row and a React key collision.
            const seen = new Set(prev.map((r) => getRowIdRef.current(r)))
            const fresh = mapped.filter((r) => {
              const id = getRowIdRef.current(r)
              return id === undefined || !seen.has(id)
            })
            const next = [...prev, ...fresh]
            loadedRef.current = next.length
            return next
          })
        } else {
          setRows(mapped)
          loadedRef.current = mapped.length
        }
      } catch (err) {
        console.error(`[usePaginatedQuery:${table}]`, err)
        if (mountedRef.current && generation === generationRef.current) setError(err.message)
      } finally {
        if (mountedRef.current && generation === generationRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    // `filters` and the sort order are the real inputs; the rest are static per
    // call site. orderKey looks unused to the linter because the body reads
    // orderByRef — it is deliberately here so a page with sort controls
    // refetches on a sort change, without an inline object literal
    // re-triggering on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, select, filters, orderKey, tiebreak, enabled]
  )

  // First batch. Re-runs whenever the query itself changes — a filter, a sort,
  // or the batch size — and each of those legitimately invalidates every row
  // already on screen, so it replaces rather than appends.
  useEffect(() => {
    loadedRef.current = 0
    fetchWindow(0, batchSize - 1, "replace")
  }, [fetchWindow, batchSize])

  const loadMore = useCallback(() => {
    const from = loadedRef.current
    // Guard against a double-fire: the scroll observer and the button can both
    // reach this, and an in-flight batch would otherwise be requested twice.
    if (loadingMore || loading) return
    if (from === 0) return
    fetchWindow(from, from + batchSize - 1, "append")
  }, [fetchWindow, batchSize, loading, loadingMore])

  /**
   * Re-reads everything currently on screen, in one request.
   *
   * A mutation must not collapse the list back to one batch — someone who has
   * scrolled to 200 rows and marks an order delivered should still be looking
   * at 200 rows, in the same place.
   */
  const refresh = useCallback(
    (isBackground = false) => {
      const loaded = Math.max(loadedRef.current, batchSize)
      return fetchWindow(0, loaded - 1, "replace", isBackground)
    },
    [fetchWindow, batchSize]
  )

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => {
      // Skip a state change (and so a refetch) when nothing actually differs.
      // The search box pushes its debounced value on mount, and every list
      // would otherwise load twice on arrival.
      const next = { ...prev, ...newFilters }
      const same = Object.keys(next).every((k) => next[k] === prev[k])
      return same ? prev : next
    })
  }, [])

  return {
    rows,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore: rows.length < totalCount,
    loadMore,
    batchSize,
    filters,
    updateFilters,
    setRows,
    refresh,
  }
}
