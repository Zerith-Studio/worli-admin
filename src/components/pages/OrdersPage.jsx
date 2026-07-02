// ============================================
// FILE: components/pages/OrdersPage.jsx
// - Mark Delivered now calls rpc_mark_order_delivered via hook (wallet deduction)
// - Added customer name / order number search filter
// - Retry Tomorrow actually reschedules order to next day
// - Confirmation dialog before marking delivered
// ============================================

import React, { useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useDrivers } from '../../hooks/useDrivers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SearchInput } from '../ui/SearchInput';
import { UserNameLink } from '../ui/UserNameLink';
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
    retryOrder,
    autoAssignOrders,
    refresh,
  } = useOrders();

  const { drivers } = useDrivers();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [failModal, setFailModal] = useState(null);
  const [failReasonEdit, setFailReasonEdit] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState(null);
  const [deliverModal, setDeliverModal] = useState(null);  // confirmation
  const [delivering, setDelivering] = useState(false);
  const [deliverMsg, setDeliverMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [photoModal, setPhotoModal] = useState(null); // url string or null
  const [reassignModal, setReassignModal] = useState(null); // order object
  const [selectedDriver, setSelectedDriver] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState(null); // { ordersAssigned, returnsAssigned } | null

  useDataRefresh(refresh, 60000, true);

  // Client-side search filter (name or order number)
  const displayedOrders = search.trim()
    ? orders.filter(o =>
        o.customerName.toLowerCase().includes(search.toLowerCase()) ||
        o.orderNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const handleMarkDelivered = (o) => {
    setDeliverModal(o);
    setDeliverMsg(null);
  };

  const confirmMarkDelivered = async () => {
    if (!deliverModal) return;
    setDelivering(true);
    const result = await updateOrderStatus(deliverModal.id, 'delivered');
    setDelivering(false);
    if (result.success) {
      setDeliverModal(null);
    } else {
      setDeliverMsg({ ok: false, text: result.error });
    }
  };

  const openFailModal = (o) => {
    setFailModal(o);
    setFailReasonEdit(o.failReason || FAIL_REASONS[0]);
    setRetryMsg(null);
  };

  const handleRetryTomorrow = async () => {
    if (!failModal) return;
    setRetrying(true);
    const result = await retryOrder(failModal.id, failReasonEdit);
    setRetrying(false);
    if (result.success) {
      setRetryMsg({ ok: true, text: 'Rescheduled to tomorrow ✓' });
      setTimeout(() => setFailModal(null), 1200);
    } else {
      setRetryMsg({ ok: false, text: result.error });
    }
  };

  const handleReassignSubmit = async () => {
    if (!selectedDriver || !reassignModal) return;
    setReassigning(true);
    const result = await reassignDriver(reassignModal.id, selectedDriver);
    setReassigning(false);
    if (result.success) {
      setReassignModal(null);
      setSelectedOrder(prev => prev ? { ...prev, riderId: selectedDriver } : null);
    } else {
      alert("Failed to reassign: " + result.error);
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    const result = await autoAssignOrders(filters.date);
    setAutoAssigning(false);
    if (!result.success) {
      alert("Auto-assignment failed: " + result.error);
      return;
    }
    setAssignResult({
      ordersAssigned: result.ordersAssigned,
      returnsAssigned: result.returnsAssigned,
    });
  };

  // Auto-dismiss the assignment toast after a few seconds.
  React.useEffect(() => {
    if (!assignResult) return;
    const t = setTimeout(() => setAssignResult(null), 5000);
    return () => clearTimeout(t);
  }, [assignResult]);

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
      {assignResult && (
        <div
          onClick={() => setAssignResult(null)}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1000,
            background: 'var(--green)',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            maxWidth: 360,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {(() => {
            const o = assignResult.ordersAssigned;
            const r = assignResult.returnsAssigned;
            if (o === 0 && r === 0) return '✓ Auto-assignment complete — nothing new to assign.';
            const parts = [];
            if (o > 0) parts.push(`${o} order${o === 1 ? '' : 's'}`);
            if (r > 0) parts.push(`${r} bottle return${r === 1 ? '' : 's'}`);
            return `✓ Assigned ${parts.join(' and ')} to riders.`;
          })()}
        </div>
      )}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Orders</div>
          <div className="page-sub">{orders.length} orders for selected date</div>
        </div>
        <Button variant="primary" onClick={handleAutoAssign} disabled={autoAssigning}>
          {autoAssigning ? 'Running...' : 'Run Auto-Assignment'}
        </Button>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search customer or order #..."
          value={search}
          onChange={setSearch}
        />
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
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                    No orders found
                  </td>
                </tr>
              ) : displayedOrders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "var(--text-3)" }}>
                    {o.orderNumber}
                  </td>
                  <td><UserNameLink userId={o.customerId} name={o.customerName} /></td>
                  <td style={{ fontSize: 11.5, color: "var(--text-3)" }}>{o.stopName}</td>
                  <td>{o.productName} <span style={{ color: "var(--text-4)", fontSize: 11 }}>{o.productUnit}</span></td>
                  <td>×{o.quantity}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>
                    {o.amount === 0
                      ? <span style={{ color: 'var(--green)', fontSize: 12 }}>₹0 Free</span>
                      : `₹${o.amount}`}
                  </td>
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
                          onClick={() => openFailModal(o)}
                        >
                          Retry
                        </Button>
                      )}
                      {(o.status === "scheduled" || o.status === "pending" || o.status === "in_transit") && (
                        <Button 
                          size="sm" 
                          variant="primary"
                          onClick={() => handleMarkDelivered(o)}
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

      {/* ORDER DETAIL DRAWER */}
      {selectedOrder && (
        <Drawer title={`Order ${selectedOrder.orderNumber}`} onClose={() => setSelectedOrder(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Customer", val: selectedOrder.customerName },
              { label: "Date", val: selectedOrder.date },
              { label: "Product", val: `${selectedOrder.productName} (${selectedOrder.productUnit})` },
              { label: "Quantity", val: selectedOrder.manuallyEdited
                ? <span>×{selectedOrder.quantity} <span style={{ color: 'var(--yellow)', fontSize: 10 }}>✏ edited{selectedOrder.originalQuantity ? ` (was ×${selectedOrder.originalQuantity})` : ''}</span></span>
                : `×${selectedOrder.quantity}` },
              { label: "Amount", val: selectedOrder.amount === 0 ? '₹0 (Free)' : `₹${selectedOrder.amount}` },
              { label: "Stop", val: selectedOrder.stopName },
              { label: "Assigned Rider", val: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedOrder.riderId ? drivers.find(d => d.id === selectedOrder.riderId)?.name || 'Unknown' : 'Auto (via Route)'}
                    </span>
                    <Button size="sm" onClick={() => { setReassignModal(selectedOrder); setSelectedDriver(selectedOrder.riderId || ''); }}>Change</Button>
                  </div>
              ) },
            ].map(r => (
              <div key={r.label} style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: 7 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{r.val}</div>
              </div>
            ))}
          </div>

          {/* Delivery address */}
          {selectedOrder.addressLine && (
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 7, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>Delivery Address</div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>{selectedOrder.addressLine}, {selectedOrder.city}</div>
              {selectedOrder.deliveryInstructions && (
                <div style={{ fontSize: 11.5, color: 'var(--yellow)', marginTop: 3 }}>📋 {selectedOrder.deliveryInstructions}</div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div className="form-label">Status</div>
            <div style={{ marginTop: 4 }}><StatusBadge status={selectedOrder.status} /></div>
          </div>

          {selectedOrder.failReason && (
            <div style={{ padding: "10px 12px", background: "var(--red-bg)", borderRadius: 7, marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: "#991B1B" }}>
                <strong>Failure Reason:</strong> {selectedOrder.failReason}
              </div>
            </div>
          )}

          {selectedOrder.cancellationReason && (
            <div style={{ padding: "10px 12px", background: "var(--red-bg)", borderRadius: 7, marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: "#991B1B" }}>
                <strong>Cancelled:</strong> {selectedOrder.cancellationReason}
              </div>
            </div>
          )}

          {/* Delivery proof + bottle photos */}
          {selectedOrder.status === 'delivered' && (
            <div style={{ marginBottom: 12 }}>
              {/* Delivered timestamp */}
              {selectedOrder.deliveredAt && (
                <div style={{ padding: '8px 12px', background: 'var(--green-bg)', borderRadius: 7, marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, color: '#15803D' }}>
                    ✓ Delivered at {new Date(selectedOrder.deliveredAt).toLocaleTimeString()}
                    {selectedOrder.bottlesCollected > 0 && ` · 🍶 ${selectedOrder.bottlesCollected} bottle${selectedOrder.bottlesCollected > 1 ? 's' : ''} collected`}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Delivery Evidence
              </div>

              {selectedOrder.deliveryPhotoUrl ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>📸 Proof of Delivery</div>
                  <div
                    onClick={() => setPhotoModal(selectedOrder.deliveryPhotoUrl)}
                    style={{ cursor: 'zoom-in', position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}
                  >
                    <img
                      src={selectedOrder.deliveryPhotoUrl}
                      alt="Delivery proof"
                      style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, color: '#fff' }}>
                      Click to expand
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 7, marginBottom: 8, fontSize: 12, color: 'var(--text-3)' }}>
                  ⚠️ No delivery photo captured
                </div>
              )}

              {selectedOrder.bottlePhotoUrl && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>🍶 Bottle Collection Photo</div>
                  <div
                    onClick={() => setPhotoModal(selectedOrder.bottlePhotoUrl)}
                    style={{ cursor: 'zoom-in', position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}
                  >
                    <img
                      src={selectedOrder.bottlePhotoUrl}
                      alt="Bottle collection"
                      style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, color: '#fff' }}>
                      Click to expand
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedOrder.deliveryNotes && (
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 7 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>Delivery Notes</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>{selectedOrder.deliveryNotes}</div>
            </div>
          )}
        </Drawer>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {photoModal && (
        <div
          onClick={() => setPhotoModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 24,
          }}
        >
          <img
            src={photoModal}
            alt="Full size"
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setPhotoModal(null)}
            style={{
              position: 'absolute', top: 16, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}

      {/* CONFIRM MARK DELIVERED MODAL */}
      {deliverModal && (
        <Modal
          title="Confirm Mark as Delivered"
          onClose={() => setDeliverModal(null)}
          footer={
            <>
              <Button onClick={() => setDeliverModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmMarkDelivered} disabled={delivering}>
                {delivering ? 'Processing...' : 'Confirm Delivered'}
              </Button>
            </>
          }
        >
          <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.08)', borderRadius: 8, marginBottom: 14, borderLeft: '4px solid var(--green)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--green)', marginBottom: 4 }}>
              This will trigger wallet deduction
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Marking <strong>{deliverModal.customerName}</strong>'s order as delivered will run the same process as a rider delivery — including automatic wallet balance deduction.
            </div>
          </div>
          <div style={{ fontSize: 13 }}>
            <strong>Order:</strong> {deliverModal.orderNumber}<br />
            <strong>Product:</strong> {deliverModal.productName} ×{deliverModal.quantity}<br />
            <strong>Amount:</strong> {deliverModal.amount === 0 ? '₹0 (Free)' : `₹${deliverModal.amount}`}
          </div>
          {deliverMsg && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13 }}>
              {deliverMsg.text}
            </div>
          )}
        </Modal>
      )}

      {/* FAIL MODAL — Retry Tomorrow */}
      {failModal && (
        <Modal
          title="Delivery Failure — Action Required"
          onClose={() => setFailModal(null)}
          footer={
            <>
              <Button onClick={() => setFailModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleRetryTomorrow} disabled={retrying}>
                {retrying ? 'Rescheduling...' : 'Retry Tomorrow'}
              </Button>
            </>
          }
        >
          <div style={{ padding: "10px 12px", background: "var(--red-bg)", borderRadius: 7, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: "#991B1B", marginBottom: 2 }}>Failed Delivery</div>
            <div style={{ fontSize: 12, color: "#991B1B" }}>{failModal.customerName} — {failModal.failReason}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Failure Reason (confirm/update)</label>
            <select
              className="form-select"
              value={failReasonEdit}
              onChange={e => setFailReasonEdit(e.target.value)}
            >
              {FAIL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 7, fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            ℹ️ "Retry Tomorrow" will reschedule this order to tomorrow and reset status to <strong>Scheduled</strong>.
          </div>
          {retryMsg && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
              background: retryMsg.ok ? 'rgba(34,197,94,0.1)' : 'var(--red-bg)',
              color: retryMsg.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {retryMsg.text}
            </div>
          )}
        </Modal>
      )}

      {/* REASSIGN MODAL */}
      {reassignModal && (
        <Modal
          title={`Reassign Order — ${reassignModal.orderNumber}`}
          onClose={() => setReassignModal(null)}
          footer={
            <>
              <Button onClick={() => setReassignModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleReassignSubmit} disabled={reassigning || !selectedDriver}>
                {reassigning ? 'Reassigning...' : 'Confirm Assignment'}
              </Button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Select Driver for Order</label>
            <select
              className="form-select"
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
            >
              <option value="">— Select a Driver —</option>
              {drivers.filter(d => d.status === 'active').map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
              ))}
            </select>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 7, fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            ℹ️ Reassigning an order will explicitly force it to this driver, bypassing standard route assignments.
          </div>
        </Modal>
      )}
    </div>
  );
}
