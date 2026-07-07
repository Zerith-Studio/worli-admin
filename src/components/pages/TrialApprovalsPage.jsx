// ============================================
// FILE: components/pages/TrialApprovalsPage.jsx
// Review pending trial sample claims — approve / decline.
// ============================================

import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { getFunctionErrorMessage } from "../../lib/function-errors"
import { Button } from "../ui/Button"
import { StatusBadge } from "../ui/StatusBadge"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { UserNameLink } from "../ui/UserNameLink"

function fmtDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function TrialApprovalsPage() {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [actioning, setActioning] = useState(null)   // claim id currently being processed
  const [expanded, setExpanded] = useState(null)     // claim id whose orders are shown
  const [ordersByClaim, setOrdersByClaim] = useState({})

  // ── Fetch claims ────────────────────────────────────────────
  const fetchClaims = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from("trial_sample_claims")
        .select("*, users(full_name, phone_number)")
        .order("created_at", { ascending: false })
      if (!showAll) query = query.eq("status", "pending")
      const { data, error: err } = await query
      if (err) throw err
      setClaims(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [showAll])

  useEffect(() => { fetchClaims() }, [fetchClaims])

  // ── Load orders attached to a claim ─────────────────────────
  const toggleOrders = async (claim) => {
    if (expanded === claim.id) { setExpanded(null); return }
    setExpanded(claim.id)
    if (!ordersByClaim[claim.id]) {
      const { data } = await supabase
        .from("orders")
        .select("order_number, delivery_date, quantity, status")
        .eq("trial_claim_id", claim.id)
      setOrdersByClaim((prev) => ({ ...prev, [claim.id]: data || [] }))
    }
  }

  // ── Approve / Decline ───────────────────────────────────────
  const reviewClaim = async (claim, approve) => {
    if (!window.confirm(`${approve ? "Approve" : "Decline"} this trial claim?`)) return
    setActioning(claim.id)
    try {
      const res = await supabase.functions.invoke("admin-db-action", {
        body: {
          action: "rpc",
          fn: "rpc_review_trial_claim",
          params: { p_claim_id: claim.id, p_approve: approve },
        },
      })
      if (res.error || res.data?.error) {
        throw new Error(await getFunctionErrorMessage(res.error, res.data))
      }
      await fetchClaims()
    } catch (e) {
      alert("Error: " + e.message)
    } finally {
      setActioning(null)
    }
  }

  const pendingCount = claims.filter((c) => c.status === "pending").length

  if (loading && claims.length === 0) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><LoadingSpinner /></div>
  }

  if (error) {
    return <div className="card" style={{ margin: "20px", padding: "20px", color: "var(--red)" }}>Error: {error}</div>
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Trial Approvals</div>
          <div className="page-sub">{pendingCount} pending claim{pendingCount === 1 ? "" : "s"}</div>
        </div>
        <Button variant="secondary" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show Pending Only" : "Show All"}
        </Button>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Requested</th>
                <th>Free / Paid</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>No claims found</td></tr>
              )}
              {claims.map((claim) => {
                const orders = ordersByClaim[claim.id]
                const isExpanded = expanded === claim.id
                return (
                  <React.Fragment key={claim.id}>
                    <tr>
                      <td>
                        <UserNameLink userId={claim.user_id} name={claim.users?.full_name} phone={claim.users?.phone_number} />
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>{fmtDate(claim.created_at)}</td>
                      <td>
                        {claim.is_free
                          ? <span style={{ color: "var(--green)", fontWeight: 600 }}>Free (referral)</span>
                          : <span>₹{claim.charged_amount ?? 0}</span>}
                      </td>
                      <td><StatusBadge status={claim.status} /></td>
                      <td>
                        <Button variant="secondary" onClick={() => toggleOrders(claim)}>
                          {isExpanded ? "Hide" : "View"}
                        </Button>
                      </td>
                      <td>
                        {claim.status === "pending" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <Button
                              variant="primary"
                              disabled={actioning === claim.id}
                              onClick={() => reviewClaim(claim, true)}
                            >
                              {actioning === claim.id ? "…" : "Approve"}
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={actioning === claim.id}
                              style={{ color: "var(--red)", borderColor: "var(--red)" }}
                              onClick={() => reviewClaim(claim, false)}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                            {claim.reviewed_at ? `Reviewed ${fmtDate(claim.reviewed_at)}` : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ background: "var(--bg)" }}>
                          {!orders ? (
                            <div style={{ padding: 12, color: "var(--text-3)", fontSize: 12 }}>Loading orders…</div>
                          ) : orders.length === 0 ? (
                            <div style={{ padding: 12, color: "var(--text-3)", fontSize: 12 }}>No orders linked to this claim.</div>
                          ) : (
                            <table className="data-table" style={{ margin: 8 }}>
                              <thead>
                                <tr>
                                  <th>Order #</th>
                                  <th>Delivery Date</th>
                                  <th>Qty</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orders.map((o, i) => (
                                  <tr key={i}>
                                    <td>{o.order_number || "—"}</td>
                                    <td>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString("en-IN") : "—"}</td>
                                    <td>{o.quantity ?? "—"}</td>
                                    <td><StatusBadge status={o.status} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
