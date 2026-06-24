// ============================================================
// FILE: src/components/pages/NotificationsPage.jsx
// Admin Dashboard — Rich Push Notification Composer & History
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { Drawer } from "../ui/Drawer"

// ─── Image upload (mirrors ProductsPage pattern) ──────────────
const NOTIF_BUCKET = "notification-images"

async function uploadNotificationImage(file) {
  const ext = file.name.split(".").pop()
  const path = `notifications/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(NOTIF_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(NOTIF_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ─── Deep-link screen targets ─────────────────────────────────
// Static screens + two dynamic ones (product, order) that need params.
const SCREEN_OPTIONS = [
  { key: "home", label: "Home" },
  { key: "wallet", label: "Wallet" },
  { key: "orders", label: "Orders" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "account", label: "Account" },
  { key: "refer", label: "Refer" },
  { key: "free_sample", label: "Free Sample" },
  { key: "product", label: "Product (pick a product)" },
  { key: "order", label: "Order (enter order id)" },
]

// ─── Notification type badge colors ──────────────────────────
const TYPE_COLORS = {
  general: { bg: "#E8F4FD", text: "#1A6FA8" },
  order: { bg: "#E8F5E9", text: "#2E7D32" },
  subscription: { bg: "#FFF3E0", text: "#E65100" },
  low_bottles: { bg: "#FBE9E7", text: "#BF360C" },
}

const TARGET_LABELS = {
  all: "All Users",
  specific: "Specific Users",
  segment: "Segment",
}

// ─── Preview Card Component ───────────────────────────────────
function NotificationPreview({ title, body, imageUrl }) {
  return (
    <div style={{
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      overflow: "hidden",
      background: "#FAFAFA",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <div style={{ padding: "8px 12px", background: "#1A1A2E", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: "#101B53", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: "white" }}>W</span>
        </div>
        <span style={{ color: "#9CA3AF", fontSize: 11 }}>Worli Dairy · now</span>
      </div>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Notification"
          style={{ width: "100%", maxHeight: 150, objectFit: "cover" }}
          onError={(e) => { e.target.style.display = "none" }}
        />
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#111", marginBottom: 4 }}>
          {title || "Notification Title"}
        </div>
        <div style={{ fontSize: 13, color: "#444", lineHeight: 1.5 }}>
          {body || "Your notification message will appear here."}
        </div>
      </div>
    </div>
  )
}

// ─── User Search Component ────────────────────────────────────
function UserSearch({ selectedUsers, onSelectionChange }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const handleSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from("users")
      .select("id, full_name, phone_number, expo_push_token")
      .or(`full_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .limit(10)
    setResults(data || [])
    setSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => handleSearch(search), 300)
    return () => clearTimeout(t)
  }, [search, handleSearch])

  const toggle = (user) => {
    const exists = selectedUsers.find((u) => u.id === user.id)
    onSelectionChange(
      exists ? selectedUsers.filter((u) => u.id !== user.id) : [...selectedUsers, user]
    )
  }

  return (
    <div>
      <input
        className="form-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone..."
        style={{ marginBottom: 8 }}
      />
      {searching && <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>Searching…</div>}
      {results.length > 0 && (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 8,
          maxHeight: 200,
          overflowY: "auto",
        }}>
          {results.map((u) => {
            const selected = !!selectedUsers.find((s) => s.id === u.id)
            const hasToken = !!u.expo_push_token
            return (
              <div
                key={u.id}
                onClick={() => hasToken && toggle(u)}
                style={{
                  padding: "8px 12px",
                  cursor: hasToken ? "pointer" : "not-allowed",
                  background: selected ? "rgba(16,27,83,0.07)" : "white",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: hasToken ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{u.phone_number}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {!hasToken && <span style={{ fontSize: 11, color: "#F59E0B", background: "#FEF3C7", padding: "1px 6px", borderRadius: 4 }}>No token</span>}
                  {selected && <span style={{ fontSize: 18, color: "var(--green)" }}>✓</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {selectedUsers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selectedUsers.map((u) => (
            <div key={u.id} style={{
              background: "var(--bg-accent)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              {u.full_name || u.phone_number}
              <span
                onClick={() => toggle(u)}
                style={{ cursor: "pointer", color: "var(--red)", fontWeight: 700 }}
              >×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Notification Detail Drawer ───────────────────────────────
// Shows every field stored on a push_notifications row.
function NotificationDetailDrawer({ notif, onClose }) {
  const [recipients, setRecipients] = useState(null)

  // Resolve the user_ids list (if any) into names for readability.
  useEffect(() => {
    let active = true
    const ids = notif.user_ids
    if (Array.isArray(ids) && ids.length > 0) {
      supabase
        .from("users")
        .select("id, full_name, phone_number")
        .in("id", ids)
        .then(({ data }) => { if (active) setRecipients(data || []) })
    }
    return () => { active = false }
  }, [notif.user_ids])

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

  const Row = ({ label, children }) => (
    <div className="stat-row" style={{ alignItems: "flex-start" }}>
      <div className="stat-label" style={{ minWidth: 120 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, textAlign: "right", wordBreak: "break-word", maxWidth: 300 }}>{children ?? "—"}</div>
    </div>
  )

  return (
    <Drawer title="Notification Details" onClose={onClose}>
      <NotificationPreview title={notif.title} body={notif.body} imageUrl={notif.image_url} />

      <div style={{ marginTop: 16 }}>
        <Row label="ID"><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5 }}>{notif.id}</span></Row>
        <Row label="Title">{notif.title}</Row>
        <Row label="Body">{notif.body}</Row>
        <Row label="Image URL">{notif.image_url
          ? <a href={notif.image_url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>{notif.image_url}</a>
          : "—"}</Row>
        <Row label="Target Type">{TARGET_LABELS[notif.target_type] ?? notif.target_type}</Row>
        <Row label="Status">{notif.status}</Row>
        <Row label="Sent Count"><span style={{ color: "var(--green)", fontWeight: 700 }}>{notif.sent_count}</span></Row>
        <Row label="Failed Count"><span style={{ color: notif.failed_count > 0 ? "var(--red)" : "var(--text-3)" }}>{notif.failed_count}</span></Row>
        <Row label="Sent By">{notif.sent_by
          ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5 }}>{notif.sent_by}</span>
          : "—"}</Row>
        <Row label="Created At">{fmt(notif.created_at)}</Row>
        <Row label="Sent At">{fmt(notif.sent_at)}</Row>
        <Row label="Recipients">
          {!Array.isArray(notif.user_ids) || notif.user_ids.length === 0
            ? "All users (broadcast)"
            : recipients === null
              ? `${notif.user_ids.length} user(s) — loading…`
              : `${notif.user_ids.length} user(s)`}
        </Row>
      </div>

      {/* Resolved recipient list */}
      {Array.isArray(notif.user_ids) && notif.user_ids.length > 0 && recipients && recipients.length > 0 && (
        <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {recipients.map(u => (
            <div key={u.id} style={{ padding: "7px 12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{u.phone_number}</div>
            </div>
          ))}
        </div>
      )}

      {/* Raw data payload */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          Data Payload
        </div>
        <pre style={{
          background: "var(--bg)", borderRadius: 8, padding: 12, fontSize: 11.5,
          fontFamily: "'DM Mono',monospace", overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {JSON.stringify(notif.data ?? {}, null, 2)}
        </pre>
      </div>
    </Drawer>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [selectedNotif, setSelectedNotif] = useState(null)

  const defaultForm = {
    title: "",
    body: "",
    image_url: "",
    screen: "",            // deep-link target screen key (empty = none)
    productId: "",         // when screen === "product"
    orderId: "",           // when screen === "order"
    notification_type: "general",
    channel: "default",
    target: "all",         // "all" | "specific"
    selectedUsers: [],
  }
  const [form, setForm] = useState(defaultForm)

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // Products for the "Product" deep-link target
  const [products, setProducts] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase
      .from("products")
      .select("id,name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts(data || []))
  }, [])

  // ── Image upload handler ────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadError(null)
      setUploadingImage(true)
      try {
        const url = await uploadNotificationImage(file)
        updateForm({ image_url: url })
      } catch (err) {
        setUploadError(err.message)
      } finally {
        setUploadingImage(false)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Fetch sent history ──────────────────────────────────────
  const fetchHistory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("push_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchHistory() }, [])

  // ── Send notification ───────────────────────────────────────
  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      alert("Title and message are required.")
      return
    }
    if (form.target === "specific" && form.selectedUsers.length === 0) {
      alert("Please select at least one user.")
      return
    }

    setSending(true)
    setSendResult(null)

    // Build structured deep-link payload from the selected screen.
    let deepLink
    let dataPayload
    if (form.screen) {
      const params = {}
      if (form.screen === "product" && form.productId) params.productId = form.productId
      if (form.screen === "order" && form.orderId) params.orderId = form.orderId
      deepLink = `worli://${form.screen}`
      dataPayload = { screen: form.screen, params }
    }

    const body = {
      title: form.title,
      message: form.body,
      image_url: form.image_url || undefined,
      deep_link: deepLink,
      data: dataPayload,
      notification_type: form.notification_type,
      channel: form.channel,
      user_ids: form.target === "specific" ? form.selectedUsers.map((u) => u.id) : undefined,
    }

    const { data, error } = await supabase.functions.invoke("send-push-notification", { body })

    setSending(false)
    if (error || !data?.success) {
      setSendResult({ ok: false, msg: data?.error ?? error?.message ?? "Unknown error" })
    } else {
      setSendResult({ ok: true, sent: data.sent, failed: data.failed })
      setIsModalOpen(false)
      setForm(defaultForm)
      fetchHistory()
    }
  }

  // ── Quick actions ───────────────────────────────────────────
  const handleNotifyLowBottles = async () => {
    if (!window.confirm("Send low-bottles notifications to all eligible users?")) return
    setSending(true)
    const { data, error } = await supabase.functions.invoke("notify-low-bottles", { body: {} })
    setSending(false)
    if (error || !data?.success) {
      alert("Error: " + (data?.error ?? error?.message))
    } else {
      alert(`✅ Notified ${data.notified} users (${data.failed ?? 0} failed)`)
      fetchHistory()
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Notifications</div>
          <div className="page-sub">Send push notifications to users</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            onClick={handleNotifyLowBottles}
            variant="secondary"
            disabled={sending}
            title="Sends low-bottle alerts to all users below the threshold"
          >
            🥛 Alert Low-Bottle Users
          </Button>
          <Button onClick={() => { setIsModalOpen(true); setSendResult(null) }} variant="primary">
            + Send Notification
          </Button>
        </div>
      </div>

      {/* Sent history */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>
            No notifications sent yet. Click "Send Notification" to get started.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Message</th>
                <th>Target</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const typeColor = TYPE_COLORS[n.data?.notification_type] ?? TYPE_COLORS.general
                return (
                  <tr key={n.id} onClick={() => setSelectedNotif(n)} style={{ cursor: "pointer" }} title="Click to view full details">
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(n.created_at).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{n.title}</td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {n.body}
                    </td>
                    <td>
                      <span style={{
                        background: typeColor.bg,
                        color: typeColor.text,
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {TARGET_LABELS[n.target_type] ?? n.target_type}
                      </span>
                    </td>
                    <td style={{ color: "var(--green)", fontWeight: 700 }}>{n.sent_count}</td>
                    <td style={{ color: n.failed_count > 0 ? "var(--red)" : "var(--text-3)" }}>
                      {n.failed_count}
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: n.status === "sent" ? "#E8F5E9" : n.status === "failed" ? "#FFEBEE" : "#FFF8E1",
                        color: n.status === "sent" ? "#2E7D32" : n.status === "failed" ? "#C62828" : "#F57F17",
                      }}>
                        {n.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Notification detail drawer — shows every field from push_notifications */}
      {selectedNotif && (
        <NotificationDetailDrawer notif={selectedNotif} onClose={() => setSelectedNotif(null)} />
      )}

      {/* Send Modal */}
      {isModalOpen && (
        <Modal
          title="Send Push Notification"
          onClose={() => { setIsModalOpen(false); setSendResult(null) }}
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                {form.target === "all"
                  ? "📢 Will send to all users with push tokens"
                  : `👤 ${form.selectedUsers.length} user${form.selectedUsers.length === 1 ? "" : "s"} selected`}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="secondary" onClick={() => { setIsModalOpen(false); setSendResult(null) }}>Cancel</Button>
                <Button variant="primary" onClick={handleSend} disabled={sending}>
                  {sending ? "Sending…" : "Send Now"}
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, minHeight: 400 }}>
            {/* Left: Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Target */}
              <div className="form-group">
                <label className="form-label">Target Audience</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["all", "specific"].map((t) => (
                    <button
                      key={t}
                      onClick={() => updateForm({ target: t, selectedUsers: [] })}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 20,
                        border: "2px solid",
                        borderColor: form.target === t ? "var(--primary)" : "var(--border)",
                        background: form.target === t ? "var(--primary)" : "transparent",
                        color: form.target === t ? "white" : "var(--text-2)",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {t === "all" ? "📢 All Users" : "👤 Specific Users"}
                    </button>
                  ))}
                </div>
              </div>

              {/* User search */}
              {form.target === "specific" && (
                <div className="form-group">
                  <label className="form-label">Search Users</label>
                  <UserSearch
                    selectedUsers={form.selectedUsers}
                    onSelectionChange={(users) => updateForm({ selectedUsers: users })}
                  />
                </div>
              )}

              {/* Title */}
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  placeholder="e.g. 🚚 Your order is on the way!"
                  maxLength={100}
                />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{form.title.length}/100</div>
              </div>

              {/* Body */}
              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea
                  className="form-input"
                  value={form.body}
                  onChange={(e) => updateForm({ body: e.target.value })}
                  placeholder="Your notification message…"
                  rows={3}
                  maxLength={300}
                />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{form.body.length}/300</div>
              </div>

              {/* Image URL + upload */}
              <div className="form-group">
                <label className="form-label">Image URL <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional — for rich notification)</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={form.image_url}
                    onChange={(e) => updateForm({ image_url: e.target.value })}
                    placeholder="https://..."
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? "Uploading…" : "📷 Upload"}
                  </Button>
                </div>
                {uploadError && (
                  <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{uploadError}</div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  Uploads to Supabase Storage (notification-images bucket).
                </div>
              </div>

              {/* Deep link / screen selector */}
              <div className="form-group">
                <label className="form-label">Screen / Deep Link <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span></label>
                <select
                  className="form-input"
                  value={form.screen}
                  onChange={(e) => updateForm({ screen: e.target.value, productId: "", orderId: "" })}
                >
                  <option value="">— None —</option>
                  {SCREEN_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>

                {/* Dynamic: Product picker */}
                {form.screen === "product" && (
                  <select
                    className="form-input"
                    style={{ marginTop: 8 }}
                    value={form.productId}
                    onChange={(e) => updateForm({ productId: e.target.value })}
                  >
                    <option value="">— Select product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}

                {/* Dynamic: Order id input */}
                {form.screen === "order" && (
                  <input
                    className="form-input"
                    style={{ marginTop: 8 }}
                    value={form.orderId}
                    onChange={(e) => updateForm({ orderId: e.target.value })}
                    placeholder="Order id / number"
                  />
                )}
              </div>

              {/* Type + Channel */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-input"
                    value={form.notification_type}
                    onChange={(e) => updateForm({ notification_type: e.target.value })}
                  >
                    <option value="general">General</option>
                    <option value="order">Order</option>
                    <option value="subscription">Subscription</option>
                    <option value="low_bottles">Low Bottles</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Android Channel</label>
                  <select
                    className="form-input"
                    value={form.channel}
                    onChange={(e) => updateForm({ channel: e.target.value })}
                  >
                    <option value="default">Default</option>
                    <option value="orders">Orders (High priority)</option>
                    <option value="bottles">Bottles (Normal)</option>
                  </select>
                </div>
              </div>

              {/* Send result */}
              {sendResult && (
                <div style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: sendResult.ok ? "#E8F5E9" : "#FFEBEE",
                  color: sendResult.ok ? "#2E7D32" : "#C62828",
                  fontWeight: 600,
                  fontSize: 13,
                }}>
                  {sendResult.ok
                    ? `✅ Sent to ${sendResult.sent} device${sendResult.sent === 1 ? "" : "s"}${sendResult.failed > 0 ? ` (${sendResult.failed} failed)` : ""}`
                    : `❌ Error: ${sendResult.msg}`}
                </div>
              )}
            </div>

            {/* Right: Preview */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                Preview
              </div>
              <NotificationPreview title={form.title} body={form.body} imageUrl={form.image_url} />
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
                📱 Actual appearance varies by device and OS version.
                {form.image_url && " Image requires a publicly accessible URL."}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
