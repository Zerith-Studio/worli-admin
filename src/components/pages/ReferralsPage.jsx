import React from "react"
import { Badge } from "../ui/Badge"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { LoadMore } from "../ui/LoadMore"
import { RowsPerLoad } from "../ui/RowsPerLoad"
import { UserNameLink } from "../ui/UserNameLink"
import { usePaginatedQuery } from "../../hooks/usePaginatedQuery"

const SELECT =
  "*, referrer:users!referrer_id(id, full_name, phone_number), referee:users!referee_id(id, full_name, phone_number)"

export function ReferralsPage() {
  // Previously fetched the whole table. That doesn't fail loudly as referrals
  // accumulate — PostgREST just stops at its max-rows ceiling and the page
  // quietly shows a prefix while claiming to show "N total referrals".
  const { rows: referrals, loading, error, totalCount, loadingMore, loadMore } =
    usePaginatedQuery({
      table: "referrals",
      select: SELECT,
    })

  if (loading && referrals.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Referrals</div>
        <div className="page-sub">
          {totalCount.toLocaleString("en-IN")} total referrals
        </div>
      </div>
      {error && (
        <div className="card" style={{ marginBottom: 12, color: "var(--red)" }}>
          Error loading referrals: {error}
        </div>
      )}
      <div className="search-filter">
        <RowsPerLoad />
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Code</th>
              <th>Referrer</th>
              <th>Referee</th>
              <th>Reward (Referrer)</th>
              <th>Reward (Referee)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((ref) => (
              <tr key={ref.id}>
                <td>{new Date(ref.created_at).toLocaleDateString()}</td>
                <td><code style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{ref.referral_code || '—'}</code></td>
                <td><UserNameLink userId={ref.referrer?.id} name={ref.referrer?.full_name || ref.referrer?.phone_number} /></td>
                <td><UserNameLink userId={ref.referee?.id} name={ref.referee?.full_name || ref.referee?.phone_number} /></td>
                <td>₹{ref.referrer_reward_amount}</td>
                <td>₹{ref.referee_reward_amount}</td>
                <td><Badge variant={ref.status === "rewarded" ? "success" : ref.status === "expired" || ref.status === "cancelled" ? "danger" : "warning"}>{ref.status}</Badge></td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text-3)" }}>
                  No referrals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <LoadMore
          shown={referrals.length}
          total={totalCount}
          onLoadMore={loadMore}
          loading={loadingMore}
          label="referrals"
        />
      </div>
    </div>
  )
}
