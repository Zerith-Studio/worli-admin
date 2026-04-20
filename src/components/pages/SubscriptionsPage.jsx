// ============================================
// FILE: components/pages/SubscriptionsPage.jsx
// Subscriptions Page Component
// ============================================

import React, { useState } from 'react';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SUBSCRIPTION_TYPES, SUBSCRIPTION_STATUSES } from '../../constants';

const TYPES = [
  { value: 'all', label: 'All Types' },
  ...SUBSCRIPTION_TYPES,
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  ...SUBSCRIPTION_STATUSES,
];

export function SubscriptionsPage() {
  const {
    subscriptions,
    loading,
    error,
    filters,
    updateFilters,
    updateSubscriptionStatus,
    refresh,
  } = useSubscriptions();

  const [selectedSub, setSelectedSub] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);

  useDataRefresh(refresh, 60000, true);

  const handleToggleStatus = async (sub) => {
    const newStatus = sub.status === 'active' ? 'paused' : 'active';
    await updateSubscriptionStatus(sub.id, newStatus);
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>
        Error loading subscriptions: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="page-title">Subscriptions</div>
          <div className="page-sub">{subscriptions.length} subscriptions</div>
        </div>
        <Button variant="primary">+ New Subscription</Button>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search customer..."
          value={filters.search}
          onChange={(value) => updateFilters({ search: value })}
        />
        <Select
          value={filters.type}
          onChange={(value) => updateFilters({ type: value })}
          options={TYPES}
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
                <th>Customer</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Price/day</th>
                <th>Zone</th>
                <th>Status</th>
                <th>Override</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.customerName}</td>
                  <td>{s.productName} <span style={{ color: "var(--text-4)", fontSize: 11 }}>{s.productUnit}</span></td>
                  <td><StatusBadge status={s.type} /></td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>×{s.quantity}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>₹{s.price}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-3)" }}>{s.zone}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    {s.override ? (
                      <span className="badge badge-yellow">Override Active</span>
                    ) : (
                      <span style={{ color: "var(--text-4)", fontSize: 11.5 }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button size="sm" onClick={() => setSelectedSub(s)}>Edit</Button>
                      <Button 
                        size="sm" 
                        style={{ color: s.status === "active" ? "var(--yellow)" : "var(--green)" }}
                        onClick={() => handleToggleStatus(s)}
                      >
                        {s.status === "active" ? "Pause" : "Resume"}
                      </Button>
                      <Button 
                        size="sm" 
                        style={{ color: "var(--blue)" }}
                        onClick={() => setOverrideModal(s)}
                      >
                        Override
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSub && (
        <Drawer
          title={`Edit Subscription — ${selectedSub.customerName}`}
          onClose={() => setSelectedSub(null)}
          footer={
            <>
              <Button onClick={() => setSelectedSub(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => setSelectedSub(null)}>Save Changes</Button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Customer</label>
            <div style={{ fontWeight: 500, padding: "8px 0", fontSize: 13 }}>{selectedSub.customerName}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Product</label>
            <select className="form-select" defaultValue={selectedSub.productId}>
              <option value={selectedSub.productId}>{selectedSub.productName} ({selectedSub.productUnit})</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input type="number" className="form-input" defaultValue={selectedSub.quantity} min={1} max={10} />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Type</label>
            <select className="form-select" defaultValue={selectedSub.type}>
              <option value="daily">Daily</option>
              <option value="custom">Custom Days</option>
              <option value="on_interval">On Interval</option>
            </select>
          </div>
          {selectedSub.type === "custom" && (
            <div className="form-group">
              <label className="form-label">Custom Days</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                  <label key={d} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked={selectedSub.customDays?.includes(i + 1)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          )}
        </Drawer>
      )}

      {overrideModal && (
        <Modal
          title={`Subscription Override — ${overrideModal.customerName}`}
          onClose={() => setOverrideModal(null)}
          footer={
            <>
              <Button onClick={() => setOverrideModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOverrideModal(null)}>Apply Override</Button>
            </>
          }
        >
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14, padding: "8px 12px", background: "var(--blue-bg)", borderRadius: 7 }}>
            Override temporarily changes this subscription for a date range without cancelling it.
          </div>
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Override Product (leave blank to keep same)</label>
            <select className="form-select">
              <option value="">— Keep current product —</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Override Quantity</label>
            <input type="number" className="form-input" placeholder="Leave blank to keep same" min={0} max={10} />
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <input type="text" className="form-input" placeholder="e.g. Customer travelling, Guest arriving..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
