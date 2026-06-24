import React, { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { LoadingSpinner } from "../ui/LoadingSpinner"

const BUCKET = "product-images"

// ─── Image Upload Helper ───────────────────────────────────────────────────────
async function uploadImage(file) {
  const ext = file.name.split(".").pop()
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function deleteImage(url) {
  try {
    // Extract path from URL: everything after /object/public/<bucket>/
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return
    const path = url.slice(idx + marker.length)
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // Non-critical — just log
    console.warn("Could not delete image from storage:", url)
  }
}

// ─── Initial form state ────────────────────────────────────────────────────────
function getInitialForm() {
  return {
    name: "",
    description: "",
    volume: "",
    price: "",
    images: [],          // array of already-uploaded URLs
    features: "",        // newline-separated for the textarea
    nutritional_info: "", // JSON string
    product_type: "subscription",
    is_active: true,
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [form, setForm] = useState(getInitialForm())

  // Image upload state
  const [uploadQueue, setUploadQueue] = useState([])   // { file, preview, uploading, error }
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
      if (err) throw err
      setProducts(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── Open / Close Modal ───────────────────────────────────────────────────────
  const openModal = (product = null) => {
    setFormError(null)
    setUploadError(null)
    setUploadQueue([])
    if (product) {
      setCurrentProduct(product)
      setForm({
        name: product.name,
        description: product.description || "",
        volume: product.volume || "",
        price: String(product.price),
        // An empty images array is truthy, so fall back to the legacy
        // image_url only when there are genuinely no images. Otherwise the
        // existing image would silently drop on save.
        images: (product.images && product.images.length > 0)
          ? product.images
          : (product.image_url ? [product.image_url] : []),
        features: (product.features || []).join("\n"),
        nutritional_info: JSON.stringify(product.nutritional_info || [], null, 2),
        product_type: product.product_type || "subscription",
        is_active: product.is_active,
      })
    } else {
      setCurrentProduct(null)
      setForm(getInitialForm())
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setCurrentProduct(null)
    // Revoke object URLs for unsaved previews
    uploadQueue.forEach(q => { if (q.preview) URL.revokeObjectURL(q.preview) })
    setUploadQueue([])
  }

  // ── Form field handler ───────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  // ── Image file selection ─────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newItems = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      error: null,
    }))
    setUploadQueue(prev => [...prev, ...newItems])
    // Reset input so same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeQueued = (idx) => {
    setUploadQueue(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const removeExistingImage = (url) => {
    setForm(prev => ({ ...prev, images: prev.images.filter(u => u !== url) }))
  }

  const moveImage = (idx, dir) => {
    setForm(prev => {
      const imgs = [...prev.images]
      const target = idx + dir
      if (target < 0 || target >= imgs.length) return prev
      ;[imgs[idx], imgs[target]] = [imgs[target], imgs[idx]]
      return { ...prev, images: imgs }
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setFormError(null)
    setUploadError(null)

    if (!form.name.trim()) { setFormError("Product name is required."); return }
    if (!form.price || isNaN(parseFloat(form.price))) { setFormError("Valid price is required."); return }

    // Parse nutritional_info
    let nutritionalArr = []
    if (form.nutritional_info.trim()) {
      try { nutritionalArr = JSON.parse(form.nutritional_info) }
      catch { setFormError("Nutritional Info must be valid JSON (e.g. [{\"label\":\"Fat\",\"value\":\"3.5g\"}])."); return }
      if (!Array.isArray(nutritionalArr)) { setFormError("Nutritional Info must be a JSON array."); return }
    }

    setSaving(true)
    try {
      // Upload any queued images
      const uploadedUrls = []
      for (let i = 0; i < uploadQueue.length; i++) {
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, uploading: true } : q))
        try {
          const url = await uploadImage(uploadQueue[i].file)
          uploadedUrls.push(url)
          setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, uploading: false } : q))
        } catch (e) {
          setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, uploading: false, error: e.message } : q))
          setUploadError(`Failed to upload image: ${e.message}`)
          setSaving(false)
          return
        }
      }

      const allImages = [...(form.images || []), ...uploadedUrls]

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        volume: form.volume.trim() || null,
        price: parseFloat(form.price),
        images: allImages,
        // Keep legacy image_url as the first image for backwards compat
        image_url: allImages[0] || null,
        features: form.features
          .split("\n")
          .map(f => f.trim())
          .filter(Boolean),
        nutritional_info: nutritionalArr,
        product_type: form.product_type || "subscription",
        is_active: form.is_active,
      }

      if (currentProduct) {
        const { error: err } = await supabase.from("products").update(payload).eq("id", currentProduct.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from("products").insert([payload])
        if (err) throw err
      }

      closeModal()
      fetchProducts()
    } catch (e) {
      setFormError("Save failed: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    try {
      const { error: err } = await supabase.from("products").delete().eq("id", product.id)
      if (err) throw err
      // Best-effort delete images from storage
      for (const url of (product.images || [])) await deleteImage(url)
      fetchProducts()
    } catch (e) {
      alert("Delete failed: " + e.message)
    }
  }

  const toggleActive = async (product) => {
    const { error: err } = await supabase
      .from("products").update({ is_active: !product.is_active }).eq("id", product.id)
    if (err) { alert("Update failed: " + err.message); return }
    fetchProducts()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="page-title">Products</div>
          <div className="page-sub">{products.length} products</div>
        </div>
        <Button variant="primary" onClick={() => openModal()}>+ Add Product</Button>
      </div>

      {loading && <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LoadingSpinner /></div>}
      {error && <div className="card" style={{ color: "var(--red)", padding: 20 }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 8 }}>
          {products.map(product => (
            <div key={product.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Image */}
              <div style={{
                width: "100%", height: 160, borderRadius: 8, overflow: "hidden",
                background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid var(--border)",
              }}>
                {(product.images?.[0] || product.image_url) ? (
                  <img
                    src={product.images?.[0] || product.image_url}
                    alt={product.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                  />
                ) : null}
                <span style={{ fontSize: 40, display: (product.images?.[0] || product.image_url) ? "none" : "flex" }}>🍼</span>
              </div>

              {/* Info */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{product.name}</div>
                {product.volume && <div style={{ color: "var(--text-3)", fontSize: 12 }}>{product.volume}</div>}
                <Badge variant={product.product_type === "one_time" ? "info" : "neutral"} style={{ marginTop: 4, fontSize: 10 }}>
                  {product.product_type === "one_time" ? "One-time" : "Subscription"}
                </Badge>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>₹{product.price}</div>
                  {product.deposit_amount > 0 && (
                    <div style={{ color: "var(--text-3)", fontSize: 11 }}>+ ₹{product.deposit_amount} deposit</div>
                  )}
                </div>
                <Badge variant={product.is_active ? "success" : "neutral"}>
                  {product.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>

              {product.images?.length > 1 && (
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{product.images.length} images</div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => openModal(product)}>Edit</Button>
                <Button variant="secondary" onClick={() => toggleActive(product)}
                  style={{ flex: 1, color: product.is_active ? "var(--red)" : "var(--accent)" }}>
                  {product.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="secondary" onClick={() => handleDelete(product)}
                  style={{ color: "var(--red)", borderColor: "var(--red)" }}>🗑</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <Modal
          title={currentProduct ? `Edit — ${currentProduct.name}` : "New Product"}
          onClose={closeModal}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Product"}
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

            <div style={{ display: "flex", gap: 12 }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Name *</label>
                <input name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="Fresh Milk 500ml" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Volume</label>
                <input name="volume" className="form-input" value={form.volume} onChange={handleChange} placeholder="500ml" />
              </div>
            </div>

            {/* Price only — deposit_amount removed */}
            <div style={{ display: "flex", gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Price (₹) *</label>
                <input name="price" type="number" step="0.01" className="form-input" value={form.price} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Product Type</label>
                <select name="product_type" className="form-input" value={form.product_type} onChange={handleChange}>
                  <option value="subscription">Subscription</option>
                  <option value="one_time">One-time / Direct buy</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-input" rows={3}
                style={{ resize: "vertical" }} value={form.description} onChange={handleChange}
                placeholder="Farm fresh milk…" />
            </div>

            {/* Features */}
            <div className="form-group">
              <label className="form-label">Features <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(one per line)</span></label>
              <textarea name="features" className="form-input" rows={6}
                style={{ resize: "vertical", minHeight: 110 }} value={form.features} onChange={handleChange}
                placeholder={"No preservatives\nFarm fresh\nGlass bottle"} />
            </div>

            {/* Nutritional Info */}
            <div className="form-group">
              <label className="form-label">
                Nutritional Info <span style={{ fontWeight: 400, color: "var(--text-3)" }}>
                  (JSON array: <code style={{ fontSize: 10 }}>[{"{\"label\":\"Fat\",\"value\":\"3.5g\"}"}]</code>)
                </span>
              </label>
              <textarea name="nutritional_info" className="form-input" rows={7}
                style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12, minHeight: 130 }}
                value={form.nutritional_info} onChange={handleChange}
                placeholder={'[\n  {"label": "Fat", "value": "3.5g"},\n  {"label": "Protein", "value": "3.2g"}\n]'} />
            </div>

            {/* ── Images ─────────────────────────────────────────────────── */}
            <div className="form-group">
              <label className="form-label">Product Images</label>

              {/* Existing saved images — show with reorder + delete */}
              {form.images.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
                  {form.images.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{
                        width: 80, height: 80, objectFit: "cover", borderRadius: 6,
                        border: "1px solid var(--border)",
                      }} />
                      {/* Delete */}
                      <button
                        onClick={() => removeExistingImage(url)}
                        title="Remove image"
                        style={{
                          position: "absolute", top: -6, right: -6,
                          width: 20, height: 20, borderRadius: "50%",
                          background: "var(--red)", color: "#fff", border: "none",
                          cursor: "pointer", fontSize: 11, lineHeight: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✕</button>
                      {/* Reorder arrows */}
                      <div style={{
                        position: "absolute", bottom: -18, left: 0, right: 0,
                        display: "flex", justifyContent: "center", gap: 2,
                      }}>
                        {i > 0 && (
                          <button onClick={() => moveImage(i, -1)} title="Move left"
                            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer", fontSize: 9, padding: "1px 3px" }}>←</button>
                        )}
                        {i < form.images.length - 1 && (
                          <button onClick={() => moveImage(i, 1)} title="Move right"
                            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer", fontSize: 9, padding: "1px 3px" }}>→</button>
                        )}
                      </div>
                      {i === 0 && (
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          background: "rgba(0,0,0,0.55)", color: "#fff",
                          fontSize: 9, textAlign: "center", borderRadius: "0 0 6px 6px", padding: "1px 0",
                        }}>cover</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Queued new images */}
              {uploadQueue.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  {uploadQueue.map((q, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={q.preview} alt="" style={{
                        width: 80, height: 80, objectFit: "cover", borderRadius: 6,
                        border: `1px solid ${q.error ? "var(--red)" : "var(--accent)"}`,
                        opacity: q.uploading ? 0.5 : 1,
                      }} />
                      {q.uploading && (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex",
                          alignItems: "center", justifyContent: "center", borderRadius: 6,
                          background: "rgba(0,0,0,0.3)",
                        }}>
                          <LoadingSpinner size="small" />
                        </div>
                      )}
                      {!q.uploading && (
                        <button onClick={() => removeQueued(i)} title="Remove"
                          style={{
                            position: "absolute", top: -6, right: -6,
                            width: 20, height: 20, borderRadius: "50%",
                            background: "var(--red)", color: "#fff", border: "none",
                            cursor: "pointer", fontSize: 11,
                          }}>✕</button>
                      )}
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "rgba(0,0,0,0.55)", color: "#fff",
                        fontSize: 9, textAlign: "center", borderRadius: "0 0 6px 6px", padding: "1px 0",
                      }}>new</div>
                    </div>
                  ))}
                </div>
              )}

              {uploadError && (
                <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>{uploadError}</div>
              )}

              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%" }}>
                📷 Choose Images to Upload
              </Button>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Images are uploaded to Supabase Storage (product-images bucket) when you save.
              </div>
            </div>

            {/* Active toggle */}
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
