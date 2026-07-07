// ============================================
// FILE: components/pages/SubscriptionsPage.jsx
// Fixed: pause dates min=today, paused subs show date range in table.
// ============================================

import React, { useState } from 'react';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Pagination } from '../ui/Pagination';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { UserNameLink } from '../ui/UserNameLink';
import { SUBSCRIPTION_TYPES, SUBSCRIPTION_STATUSES } from '../../constants';

const TYPES = [{ value: 'all', label: 'All Types' }, ...SUBSCRIPTION_TYPES];
const STATUSES = [{ value: 'all', label: 'All Statuses' }, ...SUBSCRIPTION_STATUSES];

// Returns today's date in YYYY-MM-DD (local time)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtDuration(sub) {
  if (sub.durationMonths && sub.durationDays) return `${sub.durationMonths}mo / ${sub.durationDays}d`;
  if (sub.durationDays) return `${sub.durationDays}d`;
  if (sub.durationMonths) return `${sub.durationMonths}mo`;
  return '—';
}

export function SubscriptionsPage() {
  const {
    subscriptions, loading, error, page, totalPages, totalCount,
    filters, updateFilters, goToPage, updateSubscriptionStatus, refresh,
  } = useSubscriptions();

  const [pauseModal, setPauseModal] = useState(null);
  const [holdDates, setHoldDates] = useState({ start: '', end: '', reason: '' });
  const [saving, setSaving] = useState(false);

  useDataRefresh(refresh, 60000, true);

  const today = todayStr();

  const handleToggleStatus = async sub => {
    if (sub.status === 'active') {
      setPauseModal(sub);
      setHoldDates({ start: today, end: '', reason: '' });
    } else if (sub.status === 'paused') {
      await updateSubscriptionStatus(sub.id, 'active');
    }
  };

  const handleApplyHold = async () => {
    if (!pauseModal || !holdDates.start || !holdDates.end) return;
    setSaving(true);
    await updateSubscriptionStatus(pauseModal.id, 'paused', {
      start_date: holdDates.start,
      end_date: holdDates.end,
      reason: holdDates.reason,
    });
    setSaving(false);
    setPauseModal(null);
    setHoldDates({ start: today, end: '', reason: '' });
  };

  if (loading && subscriptions.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Subscriptions</div>
        <div className="page-sub">{totalCount} subscriptions</div>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search customer name or phone..."
          value={filters.search}
          onChange={value => updateFilters({ search: value })}
        />
        <Select value={filters.type} onChange={value => updateFilters({ type: value })} options={TYPES} />
        <Select value={filters.status} onChange={value => updateFilters({ status: value })} options={STATUSES} />
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
                <th>Duration</th>
                <th>Date Range</th>
                <th>City</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>No subscriptions found</td></tr>
              ) : subscriptions.map(s => (
                <tr key={s.id}>
                  <td>
                    <UserNameLink userId={s.customerId} name={s.customerName} phone={s.customerPhone} />
                  </td>
                  <td>
                    {s.productName}
                    <span style={{ color: 'var(--text-4)', fontSize: 11 }}> {s.productUnit}</span>
                  </td>
                  <td><StatusBadge status={s.type} /></td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>×{s.quantity}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>
                    ₹{s.price.toFixed(2)}
                    {s.discountAmount > 0 && (
                      <span style={{ color: 'var(--green)', fontSize: 11, marginLeft: 4 }}>-₹{s.discountAmount}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {fmtDuration(s)}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {s.startDate ? fmtDate(s.startDate) : '—'}
                    {s.endDate ? <span> → {fmtDate(s.endDate)}</span> : ''}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.city}</td>
                  <td>
                    <StatusBadge status={s.status} />
                    {/* Show active pause date range */}
                    {s.status === 'paused' && s.activePause && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
                        {fmtDate(s.activePause.start_date)} → {fmtDate(s.activePause.end_date)}
                      </div>
                    )}
                  </td>
                  <td>
                    {(s.status === 'active' || s.status === 'paused') && (
                      <Button
                        size="sm"
                        style={{ color: s.status === 'active' ? 'var(--yellow)' : 'var(--green)' }}
                        onClick={() => handleToggleStatus(s)}
                      >
                        {s.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      </div>

      {pauseModal && (
        <Modal
          title={`Pause Subscription — ${pauseModal.customerName}`}
          onClose={() => setPauseModal(null)}
          footer={
            <>
              <Button onClick={() => setPauseModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleApplyHold} disabled={saving || !holdDates.start || !holdDates.end}>
                {saving ? 'Saving...' : 'Apply Hold'}
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, padding: '8px 12px', background: 'var(--blue-bg)', borderRadius: 7 }}>
            This creates a subscription hold. No deliveries will be scheduled during this period.
          </div>
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={holdDates.start}
              min={today}
              onChange={e => setHoldDates(p => ({ ...p, start: e.target.value, end: p.end < e.target.value ? '' : p.end }))} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={holdDates.end}
              min={holdDates.start || today}
              onChange={e => setHoldDates(p => ({ ...p, end: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <input type="text" className="form-input" placeholder="e.g. Customer travelling..."
              value={holdDates.reason}
              onChange={e => setHoldDates(p => ({ ...p, reason: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
