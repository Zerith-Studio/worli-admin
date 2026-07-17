// ============================================
// FILE: components/pages/CustomersPage.jsx
// Customer list. "View" opens the unified UserDetailDrawer (the single
// customer sheet used everywhere). The admin-only "Manually Trigger
// Auto-Recharge" action is kept as a dedicated button/modal.
// ============================================

import React, { useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDebouncedSearch } from '../../hooks/useDebouncedValue';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { LoadMore } from '../ui/LoadMore';
import { RowsPerLoad } from '../ui/RowsPerLoad';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { UserDetailDrawer } from '../ui/UserDetailDrawer';
import { supabase } from '../../lib/supabase';
import { throwFunctionError } from '../../lib/function-errors';

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'inactive', label: 'Inactive' },
];

export function CustomersPage() {
  const {
    customers, loading, error, totalCount, loadingMore, loadMore,
    filters, minWalletBalance, updateFilters, triggerAutoRecharge, updateUserStatus, refresh,
  } = useCustomers();

  // Search is a server filter, so it waits for a typing pause rather than
  // firing a query per keystroke.
  const [search, setSearch] = useDebouncedSearch(updateFilters);

  const [viewUserId, setViewUserId] = useState(null);
  const [rechargeCustomer, setRechargeCustomer] = useState(null);
  const [rechargeState, setRechargeState] = useState({ loading: false, error: null, successMsg: null });

  // Create customer state
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', phone: '', email: '' });
  const [createState, setCreateState] = useState({ loading: false, error: null, success: null });

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    // Phone is digits-only. Without this, maxLength={10} counts *characters*, so
    // typing "+91 9876543210" or "98765 43210" silently truncates the number.
    const next = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setCreateForm(p => ({ ...p, [name]: next }));
  };

  const handleCreateSubmit = async () => {
    if (!createForm.full_name.trim() || !createForm.phone.trim()) {
      setCreateState({ loading: false, error: 'Full name and phone number are required.', success: null });
      return;
    }
    if (createForm.full_name.trim().length < 2) {
      setCreateState({ loading: false, error: 'Name must be at least 2 characters.', success: null });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(createForm.phone.trim())) {
      setCreateState({ loading: false, error: 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).', success: null });
      return;
    }
    if (createForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      setCreateState({ loading: false, error: 'Please enter a valid email address.', success: null });
      return;
    }
    setCreateState({ loading: true, error: null, success: null });
    try {
      const res = await supabase.functions.invoke('admin-create-user', {
        body: {
          full_name: createForm.full_name.trim(),
          phone: createForm.phone.trim(),
          email: createForm.email.trim() || undefined,
        },
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);
      setCreateState({ loading: false, error: null, success: `Customer "${createForm.full_name.trim()}" created successfully! They can now log in via OTP.` });
      setCreateForm({ full_name: '', phone: '', email: '' });
      setTimeout(() => { setCreateModal(false); setCreateState({ loading: false, error: null, success: null }); refresh(); }, 2500);
    } catch (err) {
      setCreateState({ loading: false, error: err.message, success: null });
    }
  };

  useDataRefresh(refresh, 60000, true);

  if (loading && customers.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Customers</div>
          <div className="page-sub">{totalCount} total customers</div>
        </div>
        <Button variant="primary" onClick={() => { setCreateModal(true); setCreateState({ loading: false, error: null, success: null }); }}>
          + Create Customer
        </Button>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search name or phone..."
          value={search}
          onChange={setSearch}
        />
        <Select
          value={filters.status}
          onChange={value => updateFilters({ status: value })}
          options={STATUSES}
        />
        <RowsPerLoad />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th>Active Subs</th>
                <th>Wallet Balance</th>
                <th>Bottles Pending</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>No customers found</td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>{c.phone}</div>
                  </td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.city}</span></td>
                  <td><span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{c.activeSubscriptions}</span></td>
                  <td>
                    <span
                      className={`badge ${c.wallet < 0 ? 'badge-red' : c.wallet < minWalletBalance ? 'badge-yellow' : 'badge-green'}`}
                      style={{ fontFamily: "'DM Mono',monospace" }}
                    >
                      ₹{c.wallet.toLocaleString()}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-3)' }}>🍶 {c.bottles_pending} pending</span></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => setViewUserId(c.id)}>View</Button>
                      <Button
                        size="sm"
                        style={{ color: c.isActive ? 'var(--red)' : 'var(--green)' }}
                        title={c.isActive ? 'Block this account (prevents login, preserves data)' : 'Unblock this account'}
                        onClick={async () => { await updateUserStatus(c.id, !c.isActive); refresh(); }}
                      >
                        {c.isActive ? 'Block' : 'Unblock'}
                      </Button>
                      {c.auto_recharge_enabled && (
                        <Button
                          size="sm"
                          title="Manually trigger AutoPay recharge"
                          disabled={!c.razorpay_token_id}
                          onClick={() => { setRechargeState({ loading: false, error: null, successMsg: null }); setRechargeCustomer(c); }}
                        >
                          ⚡ AutoPay
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore
          shown={customers.length}
          total={totalCount}
          onLoadMore={loadMore}
          loading={loadingMore}
          label="customers"
        />
      </div>

      {/* Unified customer sheet */}
      {viewUserId && (
        <UserDetailDrawer userId={viewUserId} onClose={() => setViewUserId(null)} onUserUpdated={() => refresh()} />
      )}

      {/* Create Customer Modal */}
      {createModal && (
        <Modal
          title="Create New Customer"
          onClose={() => !createState.loading && setCreateModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreateModal(false)} disabled={createState.loading}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateSubmit} disabled={createState.loading}>
                {createState.loading ? 'Creating...' : 'Create Customer'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '10px 14px', background: 'var(--blue-bg)', borderRadius: 7, fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
              Mirrors the app signup process — phone number only (no password). The customer can log in via OTP immediately after creation.
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                name="full_name"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={createForm.full_name}
                onChange={handleCreateChange}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Number * (10 digits, without +91)</label>
              <input
                name="phone"
                className="form-input"
                placeholder="e.g. 9876543210"
                value={createForm.phone}
                onChange={handleCreateChange}
                maxLength={10}
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address (Optional)</label>
              <input
                name="email"
                type="email"
                className="form-input"
                placeholder="e.g. rahul@gmail.com"
                value={createForm.email}
                onChange={handleCreateChange}
              />
            </div>

            <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-4)' }}>
              ℹ️ Address, subscriptions, and orders can be added after creation via the customer's detail drawer ("Create" tab).
            </div>

            {createState.error && (
              <div style={{ padding: '10px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13 }}>
                ⚠️ {createState.error}
              </div>
            )}
            {createState.success && (
              <div style={{ padding: '10px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 13 }}>
                ✓ {createState.success}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Admin-only: manual auto-recharge */}
      {rechargeCustomer && (
        <Modal title="Confirm Manual Auto-Recharge" onClose={() => !rechargeState.loading && setRechargeCustomer(null)}>
          <div style={{ padding: '0 4px' }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16 }}>
              You are about to trigger a manual AutoPay deduction for <strong>{rechargeCustomer.name}</strong>.
            </p>

            <div style={{ background: 'var(--bg-2)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Current Balance:</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: rechargeCustomer.wallet < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{rechargeCustomer.wallet.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Auto-Recharge Trigger Limit:</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  ₹{rechargeCustomer.auto_recharge_trigger_amount || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 500 }}>Amount to Charge:</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 16 }}>
                  ₹{rechargeCustomer.auto_recharge_amount || 0}
                </span>
              </div>
            </div>

            {rechargeState.error && (
              <div style={{ padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                Error: {rechargeState.error}
              </div>
            )}
            {rechargeState.successMsg && (
              <div style={{ padding: 12, background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                {rechargeState.successMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setRechargeCustomer(null)} disabled={rechargeState.loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  setRechargeState(prev => ({ ...prev, loading: true, error: null }));
                  const res = await triggerAutoRecharge(rechargeCustomer.id);
                  if (res.success) {
                    setRechargeState({ loading: false, error: null, successMsg: `Successfully charged ₹${res.amount_charged} via AutoPay.` });
                    refresh();
                  } else {
                    setRechargeState({ loading: false, error: res.error, successMsg: null });
                  }
                }}
                disabled={rechargeState.loading}
              >
                {rechargeState.loading ? 'Processing...' : 'Confirm Charge'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
