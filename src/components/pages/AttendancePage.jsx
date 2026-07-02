// ============================================
// FILE: components/pages/AttendancePage.jsx
// Rider Attendance & Operations Dashboard
// ============================================

import React, { useState } from "react"
import { useAttendance } from "../../hooks/useAttendance"
import { useDataRefresh } from "../../hooks/useDataRefresh"
import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { Drawer } from "../ui/Drawer"
import { StatusBadge } from "../ui/StatusBadge"

function todayStr() {
  // IST calendar date (YYYY-MM-DD) to match how the rider app stamps
  // rider_attendance.date — otherwise a browser in another timezone can query
  // the wrong day near the early-morning check-in window and miss the row.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
}

export function AttendancePage() {
  const [date, setDate] = useState(todayStr())
  const { attendance, loading, error, refresh } = useAttendance(date)
  const [selectedRider, setSelectedRider] = useState(null)

  useDataRefresh(refresh, 60000, true)

  const formatTime = (isoString) => {
    if (!isoString) return "—"
    return new Date(isoString).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
  }

  if (loading && attendance.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ margin: "20px", padding: "20px", color: "var(--red)" }}>
        Error: {error}
      </div>
    )
  }

  // Aggregate stats
  const totalRiders = attendance.length
  const presentCount = attendance.filter((r) => r.isPresent).length
  const totalOrders = attendance.reduce((acc, r) => acc + r.stats.total, 0)
  const completedOrders = attendance.reduce((acc, r) => acc + r.stats.completed, 0)

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="page-title">Attendance & Operations</div>
          <div className="page-sub">
            {presentCount} of {totalRiders} riders present today
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button variant="secondary" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 4 }}>Attendance</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "var(--primary)" }}>
              {Math.round(totalRiders ? (presentCount / totalRiders) * 100 : 0)}%
            </span>
            <span style={{ fontSize: 14, color: "var(--text-3)" }}>({presentCount}/{totalRiders})</span>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 4 }}>Total Orders Assigned</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{totalOrders}</div>
        </div>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 4 }}>Overall Progress</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "var(--green)" }}>
              {Math.round(totalOrders ? (completedOrders / totalOrders) * 100 : 0)}%
            </span>
            <span style={{ fontSize: 14, color: "var(--text-3)" }}>({completedOrders}/{totalOrders})</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rider</th>
              <th>Status</th>
              <th>Check-in Time</th>
              <th>Assigned</th>
              <th>Completed</th>
              <th>Progress</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>
                  No riders found for this date.
                </td>
              </tr>
            )}
            {attendance.map((rider) => (
              <tr key={rider.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{rider.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{rider.phone}</div>
                </td>
                <td>
                  {rider.isPresent ? (
                    <Badge variant="green">Present</Badge>
                  ) : (
                    <Badge variant="gray">Absent</Badge>
                  )}
                </td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>
                  {formatTime(rider.checkedInAt)}
                </td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{rider.stats.total}</td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--green)" }}>
                  {rider.stats.completed}
                </td>
                <td style={{ width: 150 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${rider.progress}%`,
                          background: rider.progress === 100 ? "var(--green)" : "var(--primary)",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-3)", width: 30, textAlign: "right" }}>
                      {rider.progress}%
                    </span>
                  </div>
                </td>
                <td>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedRider(rider)}>
                    View Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRider && (
        <Drawer title={`Rider Operations — ${selectedRider.name}`} onClose={() => setSelectedRider(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Status</div>
              <div style={{ marginTop: 4 }}>
                {selectedRider.isPresent ? <Badge variant="green">Present</Badge> : <Badge variant="gray">Absent</Badge>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Check-in</div>
              <div style={{ fontSize: 14, fontWeight: 500, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                {formatTime(selectedRider.checkedInAt)}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Delivery Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{selectedRider.stats.total}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Assigned</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "var(--green)" }}>{selectedRider.stats.completed}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Delivered</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "var(--yellow)" }}>{selectedRider.stats.pending}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Pending</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "var(--red)" }}>{selectedRider.stats.failed}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Failed</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Orders Breakdown</div>
          {selectedRider.stats.orders.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-4)" }}>No orders assigned today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedRider.stats.orders.map((order) => (
                <div key={order.id} style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--text-3)" }}>
                      #{order.id.slice(0, 8)}
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  {order.addresses?.delivery_instructions && (
                    <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 6, background: "var(--yellow-bg)", padding: "4px 8px", borderRadius: 4 }}>
                      📋 {order.addresses.delivery_instructions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Drawer>
      )}
    </div>
  )
}
