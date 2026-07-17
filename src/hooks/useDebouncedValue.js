// ============================================
// FILE: hooks/useDebouncedValue.js
// ============================================

import { useState, useEffect } from "react"

/**
 * Settles a rapidly-changing value (a search box) before it reaches a query.
 *
 * Search filters are server-side now, so an undebounced box fires a request per
 * keystroke — and for tables searchable by customer name, two (the name has to
 * be resolved to user ids first). Typing "sharma" meant a dozen round trips to
 * answer one question.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debounced
}

/**
 * A debounced search box bound to a usePaginatedQuery filter.
 *
 *   const [search, setSearch] = useDebouncedSearch(updateFilters)
 *   <SearchInput value={search} onChange={setSearch} />
 *
 * The input stays instant (local state) while the query waits for a pause.
 * Packaged as one hook rather than a per-page recipe because the per-page
 * version is easy to simply forget — which is how three pages ended up firing a
 * request per keystroke while three others didn't.
 */
export function useDebouncedSearch(updateFilters, { delayMs = 300, key = "search", initial = "" } = {}) {
  const [value, setValue] = useState(initial)
  const debounced = useDebouncedValue(value, delayMs)

  // `updateFilters` is safe as a dependency because usePaginatedQuery memoises
  // it with an empty dep array, so its identity never changes. Passing an
  // unmemoised function here would loop.
  useEffect(() => {
    updateFilters({ [key]: debounced })
  }, [debounced, key, updateFilters])

  return [value, setValue]
}
