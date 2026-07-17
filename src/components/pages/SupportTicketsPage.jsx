import React, { useState } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { LoadMore } from "../ui/LoadMore"
import { RowsPerLoad } from "../ui/RowsPerLoad"
import { UserNameLink } from "../ui/UserNameLink"
import { usePaginatedQuery } from "../../hooks/usePaginatedQuery"

export function SupportTicketsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTicket, setCurrentTicket] = useState(null)
  const [status, setStatus] = useState("open")
  const [saving, setSaving] = useState(false)

  // The ticket table only grows; fetching it whole meant the page silently
  // showed whatever prefix PostgREST felt like returning.
  const { rows: tickets, loading, error, totalCount, loadingMore, loadMore, refresh } =
    usePaginatedQuery({
      table: "support_tickets",
      select: "*, users(id, full_name, phone_number, is_active, bottles_pending, wallets(balance))",
      orderBy: { column: "created_at", ascending: false },
    })

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
      refresh()
    } catch (e) {
      alert("Error saving ticket: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && tickets.length === 0) return <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><LoadingSpinner /></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Support Tickets</div>
        <div className="page-sub">{totalCount.toLocaleString('en-IN')} total tickets</div>
      </div>
      {error && (
        <div className="card" style={{ marginBottom: 12, color: "var(--red)" }}>
          Error loading tickets: {error}
        </div>
      )}
      <div className="search-filter">
        <RowsPerLoad />
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
                  <UserNameLink userId={ticket.users?.id} name={ticket.users?.full_name || ticket.users?.phone_number || 'Unknown'} />
                </td>
                <td>{ticket.subject}</td>
                <td><Badge variant={ticket.status === "open" ? "warning" : ticket.status === "resolved" || ticket.status === "closed" ? "success" : "neutral"}>{ticket.status}</Badge></td>
                <td>{ticket.priority}</td>
                <td>
                  <Button variant="secondary" onClick={() => handleOpenModal(ticket)}>Manage</Button>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text-3)" }}>
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <LoadMore
          shown={tickets.length}
          total={totalCount}
          onLoadMore={loadMore}
          loading={loadingMore}
          label="tickets"
        />
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

    </div>
  )
}
