import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ title: "", message: "", user_id: "" })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    const { data } = await supabase.from("notifications").select("*, users(full_name, phone_number)").order("created_at", { ascending: false }).limit(100)
    setNotifications(data || [])
  }

  const handleSend = async () => {
    setSending(true)
    const { title, message, user_id } = formData
    try {
      if (user_id) {
         await supabase.from("notifications").insert([{ title, message, user_id, type: "system" }])
      } else {
         const { data: users } = await supabase.from("users").select("id")
         const notifs = users.map(u => ({ title, message, user_id: u.id, type: "system" }))
         // bulk insert
         await supabase.from("notifications").insert(notifs)
      }
      setIsModalOpen(false)
      fetchNotifications()
    } catch (e) {
      alert("Error sending: " + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Notifications</div>
          <div className="page-sub">Send and view alerts</div>
        </div>
        <Button onClick={() => setIsModalOpen(true)} variant="primary">Send Notification</Button>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Title</th>
              <th>Message</th>
              <th>Read</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td>{new Date(n.created_at).toLocaleString()}</td>
                <td>{n.user_id ? (n.users?.full_name || n.users?.phone_number || n.user_id) : "All Users"}</td>
                <td>{n.title}</td>
                <td>{n.message}</td>
                <td>{n.is_read ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <Modal title="Send Notification" onClose={() => setIsModalOpen(false)} footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSend} disabled={sending}>{sending ? "Sending..." : "Send"}</Button>
          </div>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">User ID (Leave empty for All Users)</label>
              <input className="form-input" value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})} placeholder="UUID" />
            </div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-input" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
