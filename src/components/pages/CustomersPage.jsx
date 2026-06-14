// ============================================
// FILE: components/pages/CustomersPage.jsx
// Removed: Add Customer button, edit (✏) button.
// Fixed: wallet balance display, city instead of zone.
// ============================================

import React, { useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Pagination } from '../ui/Pagination';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'inactive', label: 'Inactive' },
];

export function CustomersPage() {
  const {
    customers, loading, error, page, totalPages, totalCount,
    filters, minWalletBalance, updateFilters, goToPage, updateUserStatus, triggerAutoRecharge, refresh,
  } = useCustomers();

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [tab, setTab] = useState('info');
  const [statusMsg, setStatusMsg] = useState(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeState, setRechargeState] = useState({ loading: false, error: null, successMsg: null });

  useDataRefresh(refresh, 60000, true);

  if (loading && customers.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Customers</div>
        <div className="page-sub">{totalCount} total customers</div>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search name or phone..."
          value={filters.search}
          onChange={value => updateFilters({ search: value })}
        />
        <Select
          value={filters.status}
          onChange={value => updateFilters({ status: value })}
          options={STATUSES}
        />
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
                    <Button size="sm" onClick={() => { setSelectedCustomer(c); setTab('info'); setStatusMsg(null); }}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      </div>

      {selectedCustomer && (
        <Drawer title={`Customer — ${selectedCustomer.name}`} onClose={() => setSelectedCustomer(null)}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="driver-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
              {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedCustomer.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedCustomer.phone}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{selectedCustomer.city}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}><StatusBadge status={selectedCustomer.status} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Wallet', val: `₹${selectedCustomer.wallet.toLocaleString()}`, color: selectedCustomer.wallet < 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Active Subs', val: selectedCustomer.activeSubscriptions },
              { label: 'Bottles Out', val: selectedCustomer.bottles_pending },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || 'var(--text)' }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div className="tabs">
            {['info', 'wallet', 'assets', 'status'].map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {tab === 'info' && (
            <div style={{ marginTop: 12 }}>
              {[
                { label: 'Email', val: selectedCustomer.email || '—' },
                { label: 'Joined', val: selectedCustomer.joined || '—' },
                { label: 'Total Subscriptions', val: selectedCustomer.totalOrders },
              ].map(r => (
                <div key={r.label} className="stat-row">
                  <div className="stat-label">{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.val}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'wallet' && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                background: selectedCustomer.wallet < 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                borderRadius: 8, padding: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: selectedCustomer.wallet < 0 ? '#991B1B' : '#15803D', marginBottom: 4 }}>Current Balance</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: selectedCustomer.wallet < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{selectedCustomer.wallet.toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                Low balance threshold: ₹{minWalletBalance}
              </div>

              {selectedCustomer.auto_recharge_enabled ? (
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>⚡ AutoPay Enabled</span>
                    {selectedCustomer.razorpay_token_id ? (
                      <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-bg)', padding: '2px 6px', borderRadius: 4 }}>Token Active</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--yellow)', background: 'var(--yellow-bg)', padding: '2px 6px', borderRadius: 4 }}>Pending Token</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
                    Trigger Amount: <strong style={{color: 'var(--text)'}}>₹{selectedCustomer.auto_recharge_trigger_amount || 0}</strong><br/>
                    Recharge Amount: <strong style={{color: 'var(--text)'}}>₹{selectedCustomer.auto_recharge_amount || 0}</strong>
                  </div>
                  
                  {rechargeState.successMsg && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 13 }}>
                      {rechargeState.successMsg}
                    </div>
                  )}
                  {rechargeState.error && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13 }}>
                      {rechargeState.error}
                    </div>
                  )}

                  <Button 
                    variant="primary" 
                    style={{ width: '100%' }}
                    onClick={() => {
                      setRechargeState({ loading: false, error: null, successMsg: null });
                      setShowRechargeModal(true);
                    }}
                    disabled={!selectedCustomer.razorpay_token_id}
                  >
                    Manually Trigger Auto-Recharge
                  </Button>
                </div>
              ) : (
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    AutoPay is not enabled for this customer. They must set it up from the Consumer App.
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'assets' && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Bottles Pending Return</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: selectedCustomer.bottles_pending > 3 ? 'var(--red)' : 'var(--yellow)' }}>
                  🍶 {selectedCustomer.bottles_pending}
                </div>
              </div>
            </div>
          )}

          {tab === 'status' && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                padding: '12px 14px', borderRadius: 8, marginBottom: 14,
                background: selectedCustomer.isActive ? 'var(--green-bg, rgba(34,197,94,0.1))' : 'var(--red-bg)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: selectedCustomer.isActive ? 'var(--green)' : 'var(--red)' }}>
                  {selectedCustomer.isActive ? '✅ Account Active' : '🚫 Account Blocked'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {selectedCustomer.isActive
                    ? 'This customer can log in and place orders.'
                    : 'This customer cannot log in. Their data is preserved.'}
                </div>
              </div>

              {statusMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13,
                  background: statusMsg.ok ? 'var(--green-bg, rgba(34,197,94,0.1))' : 'var(--red-bg)',
                  color: statusMsg.ok ? 'var(--green)' : 'var(--red)',
                }}>
                  {statusMsg.text}
                </div>
              )}

              <Button
                variant={selectedCustomer.isActive ? 'secondary' : 'primary'}
                style={{ color: selectedCustomer.isActive ? 'var(--red)' : 'var(--green)', width: '100%' }}
                onClick={async () => {
                  const newVal = !selectedCustomer.isActive
                  const result = await updateUserStatus(selectedCustomer.id, newVal)
                  if (result.success) {
                    setSelectedCustomer(prev => ({ ...prev, isActive: newVal }))
                    setStatusMsg({ ok: true, text: newVal ? 'Account unblocked ✓' : 'Account blocked ✓' })
                  } else {
                    setStatusMsg({ ok: false, text: result.error })
                  }
                }}
              >
                {selectedCustomer.isActive ? '🚫 Block Account' : '✅ Unblock Account'}
              </Button>

              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>
                Blocking prevents login but preserves all subscriptions and data.
              </div>
            </div>
          )}
        </Drawer>
      )}

      {showRechargeModal && selectedCustomer && (
        <Modal title="Confirm Manual Auto-Recharge" onClose={() => !rechargeState.loading && setShowRechargeModal(false)}>
          <div style={{ padding: '0 4px' }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16 }}>
              You are about to trigger a manual AutoPay deduction for <strong>{selectedCustomer.name}</strong>.
            </p>
            
            <div style={{ background: 'var(--bg-2)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Current Balance:</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: selectedCustomer.wallet < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{selectedCustomer.wallet.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Auto-Recharge Trigger Limit:</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  ₹{selectedCustomer.auto_recharge_trigger_amount || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 500 }}>Amount to Charge:</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 16 }}>
                  ₹{selectedCustomer.auto_recharge_amount || 0}
                </span>
              </div>
            </div>

            {rechargeState.error && (
              <div style={{ padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                Error: {rechargeState.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowRechargeModal(false)} disabled={rechargeState.loading}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={async () => {
                  setRechargeState(prev => ({ ...prev, loading: true, error: null }));
                  const res = await triggerAutoRecharge(selectedCustomer.id);
                  if (res.success) {
                    setRechargeState({ loading: false, error: null, successMsg: `Successfully charged ₹${res.amount_charged} via AutoPay.` });
                    setShowRechargeModal(false);
                    // Update local state to reflect new balance tentatively
                    setSelectedCustomer(prev => ({
                      ...prev,
                      wallet: prev.wallet + res.amount_charged
                    }));
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
