import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { LoadingSpinner } from "../ui/LoadingSpinner"

export function AutopayQueuePage() {
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState([])

  useEffect(() => {
    fetchQueue()
  }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("autopay_queue")
        .select("*, users(full_name, phone_number)")
        .order("created_at", { ascending: false })
      if (error) throw error
      setQueue(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><LoadingSpinner /></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Autopay Queue</div>
        <div className="page-sub">{queue.length} items in queue</div>
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
          </tbody>
        </table>
      </div>
    </div>
  )
}
