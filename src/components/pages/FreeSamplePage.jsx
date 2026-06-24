import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { LoadingSpinner } from "../ui/LoadingSpinner"

export function FreeSamplePage() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(getInitialFormData())
  const [saving, setSaving] = useState(false)

  function getInitialFormData() {
    return {
      is_enabled: true,
      product_id: "",
      quantity_per_day: "1",
      trial_days: "3",
      max_bottles: "0",
      delivery_time: "07:00 AM",
      description: ""
    }
  }

  useEffect(() => {
    fetchConfig()
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from("products").select("id, name")
      if (!error && data) {
        setProducts(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from("free_sample_config")
        .select("*")
        .limit(1)
        .maybeSingle()

      if (err) throw err
      setConfig(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    if (config) {
      setFormData({
        is_enabled: config.is_enabled,
        product_id: config.product_id || "",
        quantity_per_day: String(config.quantity_per_day || 1),
        trial_days: String(config.trial_days || 3),
        max_bottles: String(config.max_bottles ?? 0),
        delivery_time: config.delivery_time || "",
        description: config.description || ""
      })
    } else {
      setFormData(getInitialFormData())
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        is_enabled: formData.is_enabled,
        product_id: formData.product_id || null,
        quantity_per_day: parseInt(formData.quantity_per_day),
        trial_days: parseInt(formData.trial_days),
        max_bottles: parseInt(formData.max_bottles) || 0,
        delivery_time: formData.delivery_time,
        description: formData.description
      }

      if (config) {
        const { error: err } = await supabase.from("free_sample_config").update(payload).eq("id", config.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from("free_sample_config").insert([payload])
        if (err) throw err
      }
      
      setIsModalOpen(false)
      fetchConfig()
    } catch (err) {
      alert("Error saving configuration: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this configuration?")) return
    try {
      const { error: err } = await supabase.from("free_sample_config").delete().eq("id", config.id)
      if (err) throw err
      fetchConfig()
    } catch (err) {
      alert("Error deleting configuration: " + err.message)
    }
  }

  if (loading) {
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

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Free Sample Configuration</div>
          <div className="page-sub">Manage free sample trial settings</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {config && (
            <Button variant="secondary" onClick={handleDelete} style={{ color: "var(--red)", borderColor: "var(--red)" }}>
              Delete
            </Button>
          )}
          <Button variant="primary" onClick={handleOpenModal}>
            {config ? "Edit Configuration" : "Create Configuration"}
          </Button>
        </div>
      </div>

      {config ? (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Status</div>
              <div><Badge variant={config.is_enabled ? "success" : "neutral"}>{config.is_enabled ? "Enabled" : "Disabled"}</Badge></div>
            </div>

            <div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Quantity Per Day</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text-1)" }}>{config.quantity_per_day || "N/A"}</div>
            </div>

            <div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Trial Duration (Days)</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text-1)" }}>{config.trial_days || "N/A"}</div>
            </div>

            <div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Max Bottles (Total Cap)</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text-1)" }}>
                {config.max_bottles > 0 ? config.max_bottles : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>No cap</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Delivery Time</div>
              <div style={{ fontSize: "14px", color: "var(--text-2)" }}>{config.delivery_time || "N/A"}</div>
            </div>
            
            <div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Product ID</div>
              <div style={{ fontSize: "14px", color: "var(--text-2)" }}>{config.product_id || "N/A"}</div>
            </div>
          </div>

          {config.description && (
            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>Description</div>
              <div style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: "1.6" }}>{config.description}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-3)" }}>
          No free sample configuration found
        </div>
      )}

      {isModalOpen && (
        <Modal title={config ? "Edit Configuration" : "New Configuration"} onClose={handleCloseModal} footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select name="product_id" className="form-input" value={formData.product_id} onChange={handleChange}>
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: "flex", gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Quantity Per Day</label>
                <input name="quantity_per_day" type="number" min="1" className="form-input" value={formData.quantity_per_day} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Trial Duration (Days)</label>
                <input name="trial_days" type="number" min="1" className="form-input" value={formData.trial_days} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Bottles Total <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(0 = no cap)</span></label>
                <input name="max_bottles" type="number" min="0" className="form-input" value={formData.max_bottles} onChange={handleChange} />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Delivery Time</label>
              <input name="delivery_time" className="form-input" value={formData.delivery_time} onChange={handleChange} placeholder="e.g., 07:00 AM" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-input" value={formData.description} onChange={handleChange} rows="3" />
            </div>
            
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <input name="is_enabled" type="checkbox" checked={formData.is_enabled} onChange={handleChange} />
              Feature Enabled
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
