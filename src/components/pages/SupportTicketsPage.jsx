import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { LoadingSpinner } from "../ui/LoadingSpinner"

export function SupportTicketsPage() {
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTicket, setCurrentTicket] = useState(null)
  const [status, setStatus] = useState("open")
  const [saving, setSaving] = useState(false)

  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, users(id, full_name, phone_number, is_active, bottles_pending, wallets(balance))")
        .order("created_at", { ascending: false })
      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (ticket) => {
    setCurrentTicket(ticket)
    setStatus(ticket.status)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = { status }
      if (status === "resolved" && currentTicket.status !== "resolved") {
        updates.resolved_at = new Date().toISOString()
      }
      await supabase.from("support_tickets").update(updates).eq("id", currentTicket.id)
      setIsModalOpen(false)
      fetchTickets()
    } catch (e) {
      alert("Error saving ticket: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><LoadingSpinner /></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Support Tickets</div>
        <div className="page-sub">{tickets.length} total tickets</div>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Date</th>
              <th>User</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.ticket_number}</td>
                <td>{new Date(ticket.created_at).toLocaleString()}</td>
                <td>
                  <div 
                    style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500 }}
                    onClick={() => {
                      const user = ticket.users;
                      const walletRaw = user?.wallets;
                      const wallet = Array.isArray(walletRaw) ? walletRaw[0] : walletRaw;
                      const balance = wallet?.balance ?? 0;
                      setSelectedUser({
                        ...user,
                        wallet_balance: balance,
                        status: user?.is_active === false ? "inactive" : "active"
                      });
                    }}
                  >
                    {ticket.users?.full_name || ticket.users?.phone_number || "Unknown"}
                  </div>
                </td>
                <td>{ticket.subject}</td>
                <td><Badge variant={ticket.status === "open" ? "warning" : ticket.status === "resolved" || ticket.status === "closed" ? "success" : "neutral"}>{ticket.status}</Badge></td>
                <td>{ticket.priority}</td>
                <td>
                  <Button variant="secondary" onClick={() => handleOpenModal(ticket)}>Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal title={`Manage Ticket ${currentTicket?.ticket_number}`} onClose={() => setIsModalOpen(false)} footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <strong>Subject:</strong> {currentTicket?.subject}
            </div>
            <div>
              <strong>Description:</strong>
              <p style={{ background: "var(--bg)", padding: 10, borderRadius: 6, marginTop: 4 }}>{currentTicket?.description}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Update Status</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {selectedUser && (
        <Modal title="User Details" onClose={() => setSelectedUser(null)} footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setSelectedUser(null)}>Close</Button>
          </div>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
              <div className="kpi-card" style={{ padding: 12 }}>
                <div className="kpi-label">Name</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedUser.full_name || "-"}</div>
              </div>
              <div className="kpi-card" style={{ padding: 12 }}>
                <div className="kpi-label">Phone</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedUser.phone_number || "-"}</div>
              </div>
              <div className="kpi-card" style={{ padding: 12 }}>
                <div className="kpi-label">Wallet Balance</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: selectedUser.wallet_balance < 0 ? "var(--red)" : "var(--green)" }}>
                  ₹{selectedUser.wallet_balance || 0}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 12 }}>
                <div className="kpi-label">Status</div>
                <div><Badge variant={selectedUser.status === "active" ? "success" : "neutral"}>{selectedUser.status || "Unknown"}</Badge></div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
