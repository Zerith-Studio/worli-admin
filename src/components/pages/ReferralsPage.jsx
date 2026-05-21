import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { LoadingSpinner } from "../ui/LoadingSpinner"

export function ReferralsPage() {
  const [loading, setLoading] = useState(true)
  const [referrals, setReferrals] = useState([])

  useEffect(() => {
    fetchReferrals()
  }, [])

  const fetchReferrals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("referrals")
        .select("*, referral_code, referrer:users!referrer_id(full_name, phone_number), referee:users!referee_id(full_name, phone_number)")
        .order("created_at", { ascending: false })
      if (error) throw error
      setReferrals(data || [])
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
        <div className="page-title">Referrals</div>
        <div className="page-sub">{referrals.length} total referrals</div>
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
                <td>{ref.referrer?.full_name || ref.referrer?.phone_number}</td>
                <td>{ref.referee?.full_name || ref.referee?.phone_number}</td>
                <td>₹{ref.referrer_reward_amount}</td>
                <td>₹{ref.referee_reward_amount}</td>
                <td><Badge variant={ref.status === "rewarded" ? "success" : ref.status === "expired" || ref.status === "cancelled" ? "danger" : "warning"}>{ref.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
