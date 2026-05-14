import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { LoadingSpinner } from "../ui/LoadingSpinner"

function getInitialForm() {
  return {
    title: "",
    description: "",
    image_url: "",
    link_url: "",
    discount_id: "",
    valid_from: "",
    valid_until: "",
    is_active: true,
    display_order: "0",
  }
}

function formatDateTimeLocal(isoString) {
  if (!isoString) return ""
  // Slice to "YYYY-MM-DDTHH:mm" for datetime-local input
  return isoString.slice(0, 16)
}

export function OffersPage() {
  const [offers, setOffers] = useState([])
  const [discounts, setDiscounts] = useState([]) // for the dropdown
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentOffer, setCurrentOffer] = useState(null)
  const [form, setForm] = useState(getInitialForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOffers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from("offers")
        .select("*, discounts(code, description)")
        .order("display_order", { ascending: true })
      if (err) throw err
      setOffers(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDiscounts = useCallback(async () => {
    const { data } = await supabase
      .from("discounts")
      .select("id, code, description")
      .eq("is_active", true)
      .order("code")
    setDiscounts(data || [])
  }, [])

  useEffect(() => {
    fetchOffers()
    fetchDiscounts()
  }, [fetchOffers, fetchDiscounts])

  // ── Open / Close ───────────────────────────────────────────────────────────
  const openModal = (offer = null) => {
    setFormError(null)
    if (offer) {
      setCurrentOffer(offer)
      setForm({
        title: offer.title,
        description: offer.description || "",
        image_url: offer.image_url || "",
        link_url: offer.link_url || "",
        discount_id: offer.discount_id || "",
        valid_from: formatDateTimeLocal(offer.valid_from),
        valid_until: formatDateTimeLocal(offer.valid_until),
        is_active: offer.is_active,
        display_order: String(offer.display_order ?? "0"),
      })
    } else {
      setCurrentOffer(null)
      setForm(getInitialForm())
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setCurrentOffer(null)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setFormError(null)
    if (!form.title.trim()) { setFormError("Title is required."); return }

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        link_url: form.link_url.trim() || null,
        discount_id: form.discount_id || null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
        display_order: parseInt(form.display_order, 10) || 0,
      }

      if (currentOffer) {
        const { error: err } = await supabase.from("offers").update(payload).eq("id", currentOffer.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from("offers").insert([payload])
        if (err) throw err
      }

      closeModal()
      fetchOffers()
    } catch (e) {
      setFormError("Save failed: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this offer?")) return
    const { error: err } = await supabase.from("offers").delete().eq("id", id)
    if (err) { alert("Delete failed: " + err.message); return }
    fetchOffers()
  }

  const toggleActive = async (offer) => {
    const { error: err } = await supabase
      .from("offers").update({ is_active: !offer.is_active }).eq("id", offer.id)
    if (err) { alert("Update failed: " + err.message); return }
    fetchOffers()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const activeCount = offers.filter(o => o.is_active).length

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Offers &amp; Creatives</div>
          <div className="page-sub">{activeCount} active · {offers.length} total</div>
        </div>
        <Button variant="primary" onClick={() => openModal()}>+ Add Offer</Button>
      </div>

      {loading && <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LoadingSpinner /></div>}
      {error && <div className="card" style={{ color: "var(--red)", padding: 20 }}>Error: {error}</div>}

      {!loading && !error && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Title</th>
                <th>Linked Discount</th>
                <th>Validity</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>No offers yet</td></tr>
              )}
              {offers.map(offer => (
                <tr key={offer.id}>
                  <td>
                    {offer.image_url ? (
                      <img src={offer.image_url} alt="" style={{
                        width: 60, height: 40, objectFit: "cover", borderRadius: 4,
                        border: "1px solid var(--border)",
                      }} />
                    ) : (
                      <div style={{
                        width: 60, height: 40, borderRadius: 4, background: "var(--bg)",
                        border: "1px solid var(--border)", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 18,
                      }}>🎉</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{offer.title}</div>
                    {offer.description && <div style={{ color: "var(--text-3)", fontSize: 11 }}>{offer.description}</div>}
                  </td>
                  <td>
                    {offer.discounts ? (
                      <Badge variant="info">{offer.discounts.code}</Badge>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {offer.valid_from ? new Date(offer.valid_from).toLocaleDateString("en-IN") : "—"}
                    {offer.valid_from && offer.valid_until ? " → " : ""}
                    {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString("en-IN") : ""}
                  </td>
                  <td>{offer.display_order}</td>
                  <td><Badge variant={offer.is_active ? "success" : "neutral"}>{offer.is_active ? "Active" : "Inactive"}</Badge></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button variant="secondary" onClick={() => openModal(offer)}>Edit</Button>
                      <Button variant="secondary"
                        onClick={() => toggleActive(offer)}
                        style={{ color: offer.is_active ? "var(--red)" : "var(--accent)" }}>
                        {offer.is_active ? "Hide" : "Show"}
                      </Button>
                      <Button variant="secondary"
                        onClick={() => handleDelete(offer.id)}
                        style={{ color: "var(--red)", borderColor: "var(--red)" }}>🗑</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <Modal
          title={currentOffer ? "Edit Offer" : "New Offer"}
          onClose={closeModal}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Offer"}
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {formError && (
              <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 6, fontSize: 13 }}>
                {formError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Title *</label>
              <input name="title" className="form-input" value={form.title} onChange={handleChange} placeholder="Summer Special" />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-input" rows={2}
                style={{ resize: "vertical" }} value={form.description} onChange={handleChange}
                placeholder="Get 20% off on your first order…" />
            </div>

            <div className="form-group">
              <label className="form-label">Banner Image URL</label>
              <input name="image_url" className="form-input" value={form.image_url} onChange={handleChange}
                placeholder="https://…" />
              {form.image_url && (
                <img src={form.image_url} alt="preview" onError={e => e.target.style.display = "none"}
                  style={{ marginTop: 8, width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Link URL <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(optional deep link)</span></label>
              <input name="link_url" className="form-input" value={form.link_url} onChange={handleChange}
                placeholder="milkride://product/..." />
            </div>

            <div className="form-group">
              <label className="form-label">Linked Discount Code <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(optional)</span></label>
              <select name="discount_id" className="form-input" value={form.discount_id} onChange={handleChange}>
                <option value="">— None —</option>
                {discounts.map(d => (
                  <option key={d.id} value={d.id}>{d.code}{d.description ? ` — ${d.description}` : ""}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Links this creative to a discount code. All math stays in the Discounts table.
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Valid From</label>
                <input name="valid_from" type="datetime-local" className="form-input"
                  value={form.valid_from} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Valid Until</label>
                <input name="valid_until" type="datetime-local" className="form-input"
                  value={form.valid_until} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Display Order <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(lower = first)</span></label>
              <input name="display_order" type="number" className="form-input"
                value={form.display_order} onChange={handleChange} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
              <span>Active (visible in consumer app)</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
