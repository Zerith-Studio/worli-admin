import React, { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { UserNameLink } from "../ui/UserNameLink"

const PAGE_SIZE = 20

// ─── Component ─────────────────────────────────────────────────────────────────
export function AddressesPage() {
  const [addresses, setAddresses] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & sort
  const [search, setSearch] = useState("")
  const [stopFilter, setStopFilter] = useState("all") // "all" | "assigned" | "unassigned"
  const [sortField, setSortField] = useState("created_at")
  const [sortDir, setSortDir] = useState("desc")

  // Route-stop assignment panel — selection is a Set of address ids. The panel
  // acts on every selected address at once (bulk assign to the same stop).
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  // Cascaded hub → route → stop data
  const [hubs, setHubs] = useState([])
  const [allRoutes, setAllRoutes] = useState([])
  const [allStops, setAllStops] = useState([])

  const [assignHub, setAssignHub] = useState("")
  const [assignRoute, setAssignRoute] = useState("")
  const [assignStop, setAssignStop] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // ── Fetch lookup data (hubs, routes, stops) ──────────────────────────────────
  useEffect(() => {
    async function fetchLookups() {
      const [{ data: hubsData }, { data: routesData }, { data: stopsData }] = await Promise.all([
        supabase.from("hubs").select("id, name").eq("is_active", true).order("name"),
        supabase.from("routes").select("id, name, hub_id").eq("is_active", true).order("name"),
        supabase.from("route_stops").select("id, name, route_id, sequence_order").eq("is_active", true).order("sequence_order"),
      ])
      if (!mountedRef.current) return
      setHubs(hubsData || [])
      setAllRoutes(routesData || [])
      setAllStops(stopsData || [])
    }
    fetchLookups()
  }, [])

  // ── Fetch addresses ──────────────────────────────────────────────────────────
  const fetchAddresses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from("addresses")
        .select(
          `id, name, address_line1, address_line2, landmark, floor_number, city, state, pincode,
           is_default, delivery_instructions, created_at,
           user_id,
           users!inner(full_name, phone_number),
           route_stop_id,
           route_stops(id, name, sequence_order, route_id, routes(name, hub_id, hubs(name)))`,
          { count: "exact" }
        )

      // Search: match on user name, phone, address line, city, pincode
      if (search.trim()) {
        const s = search.trim()
        query = query.or(
          `address_line1.ilike.%${s}%,city.ilike.%${s}%,pincode.ilike.%${s}%,users.full_name.ilike.%${s}%`
        )
      }

      // Stop filter
      if (stopFilter === "assigned") query = query.not("route_stop_id", "is", null)
      if (stopFilter === "unassigned") query = query.is("route_stop_id", null)

      // Sort
      query = query.order(sortField, { ascending: sortDir === "asc" })

      // Pagination
      const from = page * PAGE_SIZE
      const { data, error: err, count } = await query.range(from, from + PAGE_SIZE - 1)

      if (err) throw err
      if (!mountedRef.current) return
      setAddresses(data || [])
      setTotalCount(count || 0)
    } catch (e) {
      if (mountedRef.current) setError(e.message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [search, stopFilter, sortField, sortDir, page])

  useEffect(() => { fetchAddresses() }, [fetchAddresses])

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0) }, [search, stopFilter, sortField, sortDir])

  // ── Sorting helper ───────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, fontSize: 10 }}>⇅</span>
    return <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  // ── Selection ────────────────────────────────────────────────────────────────
  const selectedAddresses = addresses.filter(a => selectedIds.has(a.id))
  const anySelectedHasStop = selectedAddresses.some(a => a.route_stop_id)

  const resetCascade = () => { setAssignHub(""); setAssignRoute(""); setAssignStop("") }

  // Toggle one row's checkbox. Never pre-fills the cascade — a multi-select can
  // span addresses with different existing stops, so we start the panel blank.
  const toggleSelect = (addr) => {
    setAssignMsg(null)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(addr.id)) next.delete(addr.id)
      else next.add(addr.id)
      if (next.size === 0) resetCascade()
      return next
    })
  }

  // Select-all on the current page.
  const allOnPageSelected = addresses.length > 0 && addresses.every(a => selectedIds.has(a.id))
  const toggleSelectAll = () => {
    setAssignMsg(null)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allOnPageSelected) { addresses.forEach(a => next.delete(a.id)); resetCascade() }
      else addresses.forEach(a => next.add(a.id))
      return next
    })
  }

  const clearSelection = () => { setSelectedIds(new Set()); resetCascade(); setAssignMsg(null) }

  // Row "Assign / Change Stop" button — selects just this one address and
  // pre-fills the cascade from its current stop for a quick single edit.
  const openAssign = (addr) => {
    setAssignMsg(null)
    setSelectedIds(new Set([addr.id]))
    if (addr.route_stops) {
      setAssignHub(addr.route_stops.routes?.hub_id || "")
      setAssignRoute(addr.route_stops.route_id || "")
      setAssignStop(addr.route_stop_id || "")
    } else {
      resetCascade()
    }
  }

  const handleSaveStop = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setAssigning(true)
    setAssignMsg(null)
    try {
      const { error: err } = await supabase
        .from("addresses")
        .update({ route_stop_id: assignStop || null })
        .in("id", ids)
      if (err) throw err
      setAssignMsg({ type: "success", text: `Stop assigned to ${ids.length} address${ids.length > 1 ? "es" : ""} ✓` })
      fetchAddresses()
    } catch (e) {
      setAssignMsg({ type: "error", text: e.message })
    } finally {
      setAssigning(false)
    }
  }

  const handleClearStop = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setAssigning(true)
    try {
      const { error: err } = await supabase
        .from("addresses")
        .update({ route_stop_id: null })
        .in("id", ids)
      if (err) throw err
      setAssignMsg({ type: "success", text: `Stop cleared for ${ids.length} address${ids.length > 1 ? "es" : ""} ✓` })
      setAssignStop("")
      fetchAddresses()
    } catch (e) {
      setAssignMsg({ type: "error", text: e.message })
    } finally {
      setAssigning(false)
    }
  }

  // Derived cascade lists
  const routesForHub = allRoutes.filter(r => r.hub_id === assignHub)
  const stopsForRoute = allStops.filter(s => s.route_id === assignRoute)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Addresses</div>
          <div className="page-sub">{totalCount} addresses total</div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="form-input"
          placeholder="Search address, city, pincode, user name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: 200 }}
        />
        <select className="form-input" value={stopFilter} onChange={e => setStopFilter(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}>
          <option value="all">All Addresses</option>
          <option value="assigned">Stop Assigned</option>
          <option value="unassigned">No Stop Assigned</option>
        </select>
      </div>

      {/* ── Two-column layout: table + assignment panel ───────────────────── */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LoadingSpinner /></div>
          ) : error ? (
            <div className="card" style={{ color: "var(--red)", padding: 20 }}>Error: {error}</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input type="checkbox" checked={allOnPageSelected}
                        onChange={toggleSelectAll} title="Select all on this page"
                        style={{ cursor: "pointer" }} />
                    </th>
                    <th onClick={() => handleSort("users.full_name")} style={{ cursor: "pointer" }}>
                      User <SortIcon field="users.full_name" />
                    </th>
                    <th onClick={() => handleSort("address_line1")} style={{ cursor: "pointer" }}>
                      Address <SortIcon field="address_line1" />
                    </th>
                    <th onClick={() => handleSort("city")} style={{ cursor: "pointer" }}>
                      City <SortIcon field="city" />
                    </th>
                    <th>Route Stop</th>
                    <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer" }}>
                      Added <SortIcon field="created_at" />
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {addresses.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>No addresses found</td></tr>
                  )}
                  {addresses.map(addr => {
                    const stop = addr.route_stops
                    const isActive = selectedIds.has(addr.id)
                    return (
                      <tr key={addr.id} style={{
                        background: isActive ? "var(--accent-subtle, rgba(99,102,241,0.08))" : undefined,
                      }}>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={isActive}
                            onChange={() => toggleSelect(addr)}
                            style={{ cursor: "pointer" }} />
                        </td>
                        <td>
                          <UserNameLink userId={addr.user_id} name={addr.users?.full_name} phone={addr.users?.phone_number} />
                          {addr.name && <div style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 500, marginTop: 2 }}>{addr.name}</div>}
                          {addr.is_default && <Badge variant="info" style={{ fontSize: 10 }}>Default</Badge>}
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{addr.address_line1}</div>
                          {addr.address_line2 && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{addr.address_line2}</div>}
                          {addr.floor_number && <div style={{ fontSize: 11, color: "var(--text-3)" }}>Floor: {addr.floor_number}</div>}
                          {addr.landmark && <div style={{ fontSize: 11, color: "var(--text-3)" }}>Near: {addr.landmark}</div>}
                        </td>
                        <td>
                          <div>{addr.city || "—"}</div>
                          {addr.pincode && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{addr.pincode}</div>}
                        </td>
                        <td>
                          {stop ? (
                            <div>
                              <Badge variant="success">{stop.name}</Badge>
                              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                                {stop.routes?.hubs?.name} › {stop.routes?.name}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="neutral">Unassigned</Badge>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {new Date(addr.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td>
                          <Button variant="secondary" onClick={() => openAssign(addr)}>
                            {stop ? "Change Stop" : "Assign Stop"}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    Page {page + 1} of {totalPages} · {totalCount} total
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                    <Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Assignment Panel ────────────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="card" style={{ width: 300, flexShrink: 0, position: "sticky", top: 80 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {selectedIds.size === 1 ? "Assign Route Stop" : `Assign ${selectedIds.size} Addresses`}
            </div>
            {selectedAddresses.length === 1 ? (
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 4 }}>
                {selectedAddresses[0].name ? <strong>{selectedAddresses[0].name}</strong> : null}
                {selectedAddresses[0].name ? ' · ' : ''}{selectedAddresses[0].address_line1}{selectedAddresses[0].city ? `, ${selectedAddresses[0].city}` : ""}
                {selectedAddresses[0].floor_number ? ` · Floor: ${selectedAddresses[0].floor_number}` : ""}
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>
                {selectedIds.size} addresses selected — the chosen stop is applied to all of them.
              </div>
            )}
            {selectedAddresses.length === 1 && selectedAddresses[0].delivery_instructions && (
              <div style={{ fontSize: 11, color: 'var(--yellow)', background: 'var(--yellow-bg)', borderRadius: 5, padding: '5px 10px', marginBottom: 10 }}>
                📋 {selectedAddresses[0].delivery_instructions}
              </div>
            )}

            {assignMsg && (
              <div style={{
                padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13,
                background: assignMsg.type === "success" ? "var(--green-bg, rgba(34,197,94,0.1))" : "var(--red-bg)",
                color: assignMsg.type === "success" ? "var(--green)" : "var(--red)",
              }}>
                {assignMsg.text}
              </div>
            )}

            {/* Step 1: Hub */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>1. Hub</label>
              <select className="form-input" value={assignHub}
                onChange={e => { setAssignHub(e.target.value); setAssignRoute(""); setAssignStop("") }}>
                <option value="">— Select Hub —</option>
                {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>

            {/* Step 2: Route */}
            {assignHub && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>2. Route</label>
                {routesForHub.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-3)", paddingBottom: 8 }}>No active routes for this hub.</div>
                ) : (
                  <select className="form-input" value={assignRoute}
                    onChange={e => { setAssignRoute(e.target.value); setAssignStop("") }}>
                    <option value="">— Select Route —</option>
                    {routesForHub.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Step 3: Stop */}
            {assignRoute && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>3. Route Stop</label>
                {stopsForRoute.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-3)", paddingBottom: 8 }}>No stops configured for this route.</div>
                ) : (
                  <select className="form-input" value={assignStop}
                    onChange={e => setAssignStop(e.target.value)}>
                    <option value="">— Select Stop —</option>
                    {stopsForRoute.map(s => (
                      <option key={s.id} value={s.id}>#{s.sequence_order} — {s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button variant="primary" disabled={!assignStop || assigning}
                onClick={handleSaveStop} style={{ flex: 1 }}>
                {assigning ? "Saving…" : "Save"}
              </Button>
              {anySelectedHasStop && (
                <Button variant="secondary" disabled={assigning}
                  onClick={handleClearStop}
                  style={{ color: "var(--red)" }}>Clear</Button>
              )}
              <Button variant="secondary" onClick={clearSelection}>✕</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
