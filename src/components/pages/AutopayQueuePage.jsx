import React from "react"
import { Badge } from "../ui/Badge"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { LoadMore } from "../ui/LoadMore"
import { RowsPerLoad } from "../ui/RowsPerLoad"
import { usePaginatedQuery } from "../../hooks/usePaginatedQuery"

export function AutopayQueuePage() {
  // The queue is append-only and grows with every autopay trigger, so fetching
  // it whole was living on borrowed time.
  const { rows: queue, loading, error, totalCount, loadingMore, loadMore } =
    usePaginatedQuery({
      table: "autopay_queue",
      select: "*, users(full_name, phone_number)",
    })

  if (loading && queue.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Autopay Queue</div>
        <div className="page-sub">{totalCount.toLocaleString("en-IN")} items in queue</div>
      </div>
      {error && (
        <div className="card" style={{ marginBottom: 12, color: "var(--red)" }}>
          Error loading queue: {error}
        </div>
      )}
      <div className="search-filter">
        <RowsPerLoad />
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Triggered At</th>
              <th>User</th>
              <th>Balance at Trigger</th>
              <th>Processed</th>
              <th>Processed At</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.users?.full_name || item.users?.phone_number}</td>
                <td>₹{item.balance_at_trigger}</td>
                <td><Badge variant={item.processed ? "success" : "neutral"}>{item.processed ? "Yes" : "No"}</Badge></td>
                <td>{item.processed_at ? new Date(item.processed_at).toLocaleString() : "-"}</td>
                <td style={{ color: "var(--red)" }}>{item.error_message || "-"}</td>
              </tr>
            ))}
            {queue.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-3)" }}>
                  Nothing in the queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <LoadMore
          shown={queue.length}
          total={totalCount}
          onLoadMore={loadMore}
          loading={loadingMore}
          label="items"
        />
      </div>
    </div>
  )
}
