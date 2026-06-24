import React, { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { LoadingSpinner } from "../ui/LoadingSpinner"
import { Modal } from "../ui/Modal"

export function DiscountsPage() {
  const [loading, setLoading] = useState(true)
  const [discounts, setDiscounts] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentDiscount, setCurrentDiscount] = useState(null)
  const [formData, setFormData] = useState(getInitialFormData())
  const [saving, setSaving] = useState(false)

  function getInitialFormData() {
    return {
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: "",
      max_discount_amount: "",
      min_order_amount: "0",
      applicable_to: "all",
      product_id: "",
      max_uses: "",
      max_uses_per_user: "1",
      is_first_order_only: false,
      is_active: true,
      max_discount_orders: "",
    }
  }

  useEffect(() => {
    fetchDiscounts()
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name")
      .eq("is_active", true)
      .order("name")
    setProducts(data || [])
  }

  const fetchDiscounts = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from("discounts")
        .select("*")
        .order("created_at", { ascending: false })

      if (err) throw err
      setDiscounts(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (discount = null) => {
    if (discount) {
      setCurrentDiscount(discount)
      setFormData({
        code: discount.code,
        description: discount.description || "",
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        max_discount_amount: discount.max_discount_amount || "",
        min_order_amount: discount.min_order_amount || "0",
        applicable_to: discount.applicable_to || "all",
        product_id: discount.product_id || "",
        max_uses: discount.max_uses || "",
        max_uses_per_user: discount.max_uses_per_user || "1",
        is_first_order_only: discount.is_first_order_only || false,
        is_active: discount.is_active,
        max_discount_orders: discount.max_discount_orders || "",
      })
    } else {
      setCurrentDiscount(null)
      setFormData(getInitialFormData())
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCurrentDiscount(null)
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
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        min_order_amount: parseFloat(formData.min_order_amount || 0),
        applicable_to: formData.applicable_to,
        product_id: formData.product_id || null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        max_uses_per_user: parseInt(formData.max_uses_per_user || 1),
        is_first_order_only: formData.is_first_order_only,
        is_active: formData.is_active,
        max_discount_orders: formData.max_discount_orders ? parseInt(formData.max_discount_orders) : null,
      }

      if (currentDiscount) {
        const { error: err } = await supabase.from("discounts").update(payload).eq("id", currentDiscount.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from("discounts").insert([payload])
        if (err) throw err
      }

      handleCloseModal()
      fetchDiscounts()
    } catch (err) {
      alert("Error saving discount: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this discount?")) return
    try {
      const { error: err } = await supabase.from("discounts").delete().eq("id", id)
      if (err) throw err
      fetchDiscounts()
    } catch (err) {
      alert("Error deleting discount: " + err.message)
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
          <div className="page-title">Discounts & Promos</div>
          <div className="page-sub">
            {discounts.length} discount codes
          </div>
        </div>
        <Button onClick={() => handleOpenModal()} variant="primary">Add Discount</Button>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Applicable To</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id}>
                  <td>
                    <strong>{discount.code}</strong>
                  </td>
                  <td>{discount.discount_type}</td>
                  <td>
                    {discount.discount_type === "percentage"
                      ? `${discount.discount_value}%`
                      : `₹${discount.discount_value}`}
                  </td>
                  <td>{discount.applicable_to || "All"}</td>
                  <td>
                    {discount.current_uses}
                    {discount.max_uses ? `/${discount.max_uses}` : ""}
                  </td>
                  <td>
                    <Badge variant={discount.is_active ? "success" : "neutral"}>
                      {discount.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td>
                    <Button variant="secondary" onClick={() => handleOpenModal(discount)} style={{ marginRight: 8 }}>Edit</Button>
                    <Button variant="secondary" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={() => handleDelete(discount.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal
          title={currentDiscount ? "Edit Discount" : "New Discount"}
          onClose={handleCloseModal}
          footer={
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Code</label>
              <input name="code" className="form-input" value={formData.code} onChange={handleChange} placeholder="e.g. SUMMER10" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input name="description" className="form-input" value={formData.description} onChange={handleChange} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Type</label>
                <select name="discount_type" className="form-input" value={formData.discount_type} onChange={handleChange}>
                  <option value="percentage">Percentage</option>
                  <option value="flat_amount">Flat Amount</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Value</label>
                <input name="discount_value" type="number" className="form-input" value={formData.discount_value} onChange={handleChange} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Discount Amount (₹)</label>
                <input name="max_discount_amount" type="number" className="form-input" value={formData.max_discount_amount} onChange={handleChange} placeholder="Optional" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Min Order Amount (₹)</label>
                <input name="min_order_amount" type="number" className="form-input" value={formData.min_order_amount} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Applicable To</label>
              <select name="applicable_to" className="form-input" value={formData.applicable_to} onChange={handleChange}>
                <option value="all">All</option>
                <option value="subscription">Subscription</option>
                <option value="one_time">One Time</option>
                <option value="wallet_recharge">Wallet Recharge</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Product (optional)</label>
              <select name="product_id" className="form-input" value={formData.product_id} onChange={handleChange}>
                <option value="">All products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Leave empty to apply to all products. Selecting a product scopes this code to that one product only.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Uses (Total)</label>
                <input name="max_uses" type="number" className="form-input" value={formData.max_uses} onChange={handleChange} placeholder="Unlimited" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Uses Per User</label>
                <input name="max_uses_per_user" type="number" className="form-input" value={formData.max_uses_per_user} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Max Discounted Orders (Subscriptions)</label>
              <input name="max_discount_orders" type="number" className="form-input" value={formData.max_discount_orders} onChange={handleChange} placeholder="Optional" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input name="is_first_order_only" type="checkbox" checked={formData.is_first_order_only} onChange={handleChange} />
                First Order Only
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input name="is_active" type="checkbox" checked={formData.is_active} onChange={handleChange} />
                Active
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
