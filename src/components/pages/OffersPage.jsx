import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"

export function OffersPage() {
  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentOffer, setCurrentOffer] = useState(null)
  const [formData, setFormData] = useState(getInitialFormData())
  const [saving, setSaving] = useState(false)

  function getInitialFormData() {
    return {
      title: "",
      description: "",
      image_url: "",
      link_url: "",
      offer_type: "",
      discount_percentage: "",
      discount_amount: "",
      is_active: true,
      display_order: "0"
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [])

  const fetchOffers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .order("display_order", { ascending: true })
      if (error) throw error
      setOffers(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (offer = null) => {
    if (offer) {
      setCurrentOffer(offer)
      setFormData({
        title: offer.title,
        description: offer.description || "",
        image_url: offer.image_url || "",
        link_url: offer.link_url || "",
        offer_type: offer.offer_type || "",
        discount_percentage: offer.discount_percentage || "",
        discount_amount: offer.discount_amount || "",
        is_active: offer.is_active,
        display_order: offer.display_order || "0"
      })
    } else {
      setCurrentOffer(null)
      setFormData(getInitialFormData())
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCurrentOffer(null)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const payload = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url || null,
        link_url: formData.link_url || null,
        offer_type: formData.offer_type || null,
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : null,
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || 0
      }

      if (currentOffer) {
        const { error: err } = await supabase.from("offers").update(payload).eq("id", currentOffer.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from("offers").insert([payload])
        if (err) throw err
      }

      handleCloseModal()
      fetchOffers()
    } catch (err) {
      alert("Error saving offer: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this offer?")) return
    try {
      const { error: err } = await supabase.from("offers").delete().eq("id", id)
      if (err) throw err
      fetchOffers()
    } catch (err) {
      alert("Error deleting offer: " + err.message)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Offers & Creatives</div>
          <div className="page-sub">{offers.length} active offers</div>
        </div>
        <Button onClick={() => handleOpenModal()} variant="primary">Add Offer</Button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Active</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id}>
                <td><strong>{offer.title}</strong></td>
                <td>{offer.offer_type || "-"}</td>
                <td><Badge variant={offer.is_active ? "success" : "neutral"}>{offer.is_active ? "Active" : "Inactive"}</Badge></td>
                <td>{offer.display_order}</td>
                <td>
                  <Button variant="secondary" onClick={() => handleOpenModal(offer)} style={{ marginRight: 8 }}>Edit</Button>
                  <Button variant="secondary" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={() => handleDelete(offer.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal title={currentOffer ? "Edit Offer" : "New Offer"} onClose={handleCloseModal} footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input name="title" className="form-input" value={formData.title} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input name="description" className="form-input" value={formData.description} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Image URL</label>
              <input name="image_url" className="form-input" value={formData.image_url} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Link URL</label>
              <input name="link_url" className="form-input" value={formData.link_url} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Offer Type</label>
              <input name="offer_type" className="form-input" value={formData.offer_type} onChange={handleChange} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Discount %</label>
                <input name="discount_percentage" type="number" className="form-input" value={formData.discount_percentage} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Discount Amount</label>
                <input name="discount_amount" type="number" className="form-input" value={formData.discount_amount} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input name="display_order" type="number" className="form-input" value={formData.display_order} onChange={handleChange} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input name="is_active" type="checkbox" checked={formData.is_active} onChange={handleChange} />
              Active
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
