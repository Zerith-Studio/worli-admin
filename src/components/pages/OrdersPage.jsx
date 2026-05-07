// ============================================
// FILE: components/pages/OrdersPage.jsx
// Orders Page Component
// ============================================

import React, { useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ORDER_STATUSES, FAIL_REASONS } from '../../constants';

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  ...ORDER_STATUSES,
];

export function OrdersPage() {
  const { 
    orders, 
    loading, 
    error, 
    filters, 
    updateFilters, 
    updateOrderStatus,
    updateOrderNotes,
    reassignDriver,
    refresh,
  } = useOrders();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [failModal, setFailModal] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [noteForm, setNoteForm] = useState({ delivery_notes: '' });

  useDataRefresh(refresh, 60000, true);

  const handleMarkDelivered = async (orderId) => {
    await updateOrderStatus(orderId, 'delivered');
  };

  if (loading && orders.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>
        Error loading orders: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Orders</div>
        <div className="page-sub">{orders.length} orders</div>
      </div>

      <div className="search-filter">
        <input 
          type="date" 
          className="form-input" 
          style={{ width: 160 }} 
          value={filters.date}
          onChange={e => updateFilters({ date: e.target.value })}
        />
        <Select
          value={filters.status}
          onChange={(value) => updateFilters({ status: value })}
          options={STATUSES}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button>Bulk Action</Button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Stop</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Fail Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "var(--text-3)" }}>
                    {o.orderNumber}
                  </td>
                  <td style={{ fontWeight: 500 }}>{o.customerName}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-3)" }}>{o.stopName}</td>
                  <td>{o.productName} <span style={{ color: "var(--text-4)", fontSize: 11 }}>{o.productUnit}</span></td>
                  <td>×{o.quantity}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>₹{o.amount}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td style={{ fontSize: 11.5, color: "var(--red)", maxWidth: 140 }}>
                    {o.failReason || <span style={{ color: "var(--text-4)" }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button size="sm" onClick={() => setSelectedOrder(o)}>Details</Button>
                      {o.status === "failed" && (
                        <Button 
                          size="sm" 
                          style={{ color: "var(--red)", borderColor: "var(--red)" }}
                          onClick={() => setFailModal(o)}
                        >
                          Retry
                        </Button>
                      )}
                      {(o.status === "pending" || o.status === "in_transit") && (
                        <Button 
                          size="sm" 
                          variant="primary"
                          onClick={() => handleMarkDelivered(o.id)}
                        >
                          Mark Delivered
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <Drawer title={`Order ${selectedOrder.orderNumber}`} onClose={() => setSelectedOrder(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Customer", val: selectedOrder.customerName },
              { label: "Date", val: selectedOrder.date },
              { label: "Product", val: `${selectedOrder.productName} (${selectedOrder.productUnit})` },
              { label: "Quantity", val: `×${selectedOrder.quantity}` },
              { label: "Amount", val: `₹${selectedOrder.amount}` },
              { label: "Stop", val: selectedOrder.stopName },
            ].map(r => (
              <div key={r.label} style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: 7 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{r.val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="form-label">Status</div>
            <div style={{ marginTop: 4 }}><StatusBadge status={selectedOrder.status} /></div>
          </div>
          {selectedOrder.failReason && (
            <div style={{ padding: "10px 12px", background: "var(--red-bg)", borderRadius: 7, marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, color: "#991B1B" }}>
                <strong>Failure Reason:</strong> {selectedOrder.failReason}
              </div>
            </div>
          )}
          {selectedOrder.deliveredAt && (
            <div style={{ padding: "10px 12px", background: "var(--green-bg)", borderRadius: 7 }}>
              <div style={{ fontSize: 11.5, color: "#15803D" }}>
                ✓ Delivered at {new Date(selectedOrder.deliveredAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </Drawer>
      )}

{failModal && (
        <Modal
          title="Delivery Failure — Action Required"
          onClose={() => setFailModal(null)}
          footer={
            <>
              <Button onClick={() => setFailModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => setFailModal(null)}>Retry Tomorrow</Button>
              <Button variant="danger" onClick={() => setFailModal(null)}>Issue Refund</Button>
            </>
          }
        >
          <div style={{ padding: "10px 12px", background: "var(--red-bg)", borderRadius: 7, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: "#991B1B", marginBottom: 2 }}>Failed Delivery</div>
            <div style={{ fontSize: 12, color: "#991B1B" }}>{failModal.customerName} — {failModal.failReason}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Failure Reason (confirm/update)</label>
            <select className="form-select" defaultValue={failModal.failReason}>
              {FAIL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Action</label>
            <select className="form-select">
              <option>Retry tomorrow at same time</option>
              <option>Retry at specific time</option>
              <option>Issue wallet refund</option>
              <option>Cancel and refund</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Driver Notes</label>
            <textarea
              className="form-input"
              style={{ height: 70, paddingTop: 8 }}
              placeholder="Add notes for retry driver..."
            />
          </div>
        </Modal>
      )}

      {notesModal && (
        <Modal
          title={`Add Notes - ${notesModal.customerName}`}
          onClose={() => setNotesModal(null)}
          footer={
            <>
              <Button onClick={() => setNotesModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                updateOrderNotes(notesModal.id, noteForm.delivery_notes);
                setNotesModal(null);
                setNoteForm({ delivery_notes: '' });
              }}>Save Notes</Button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Order</label>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{notesModal.orderNumber}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Notes</label>
            <textarea
              className="form-input"
              style={{ height: 100, paddingTop: 8 }}
              placeholder="Add delivery instructions or notes..."
              value={noteForm.delivery_notes}
              onChange={(e) => setNoteForm(prev => ({ ...prev, delivery_notes: e.target.value }))}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
