// ============================================
// FILE: components/pages/WalletPage.jsx
// Dynamic low-balance threshold from DB (min_wallet_balance).
// ============================================

import React, { useState } from 'react';
import { useWalletStats } from '../../hooks/useWalletStats';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function WalletPage() {
  const {
    customers, stats, loading, error, filters, minWalletBalance,
    updateFilters, addCredit, refresh,
  } = useWalletStats();

  const [creditModal, setCreditModal] = useState(null);
  const [creditForm, setCreditForm] = useState({ amount: '', reason: '' });
  const [creditSaving, setCreditSaving] = useState(false);

  useDataRefresh(refresh, 60000, true);

  // Risk levels use the dynamic threshold from DB
  const RISK_LEVELS = [
    { value: 'all', label: 'All Balances' },
    { value: 'negative', label: 'Negative Balance' },
    { value: 'low', label: `Low (<₹${minWalletBalance})` },
    { value: 'healthy', label: 'Healthy' },
  ];

  const handleAddCredit = async () => {
    const amount = parseFloat(creditForm.amount);
    if (!amount || amount <= 0) return;
    setCreditSaving(true);
    await addCredit(creditModal.id, amount, creditForm.reason || 'Manual credit');
    setCreditSaving(false);
    setCreditModal(null);
    setCreditForm({ amount: '', reason: '' });
  };

  if (loading && customers.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Wallet & Payments</div>
        <div className="page-sub">Customer wallet balances · Low balance threshold: ₹{minWalletBalance}</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Wallet Balance</div>
          <div className="kpi-value" style={{ color: stats.totalBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
            ₹{stats.totalBalance.toLocaleString()}
          </div>
          <div className="kpi-change" style={{ color: 'var(--text-3)' }}>Across all customers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Negative Balance</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>{stats.negativeCount}</div>
          <div className="kpi-change kpi-down">Auto-pause candidates</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">At Risk (&lt;₹{minWalletBalance})</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}>{stats.atRiskCount}</div>
          <div className="kpi-change" style={{ color: 'var(--yellow)' }}>⚡ Recharge reminder needed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Healthy Balance</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>{stats.healthyCount}</div>
          <div className="kpi-change kpi-up">✓ No action needed</div>
        </div>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search customer..."
          value={filters.search}
          onChange={value => updateFilters({ search: value })}
        />
        <Select
          value={filters.riskLevel}
          onChange={value => updateFilters({ riskLevel: value })}
          options={RISK_LEVELS}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Wallet Balance</th>
                <th>Reserved</th>
                <th>Balance Bar</th>
                <th>Risk Level</th>
                <th>Active Subs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>No customers found</td></tr>
              ) : customers.map(c => {
                const risk = c.balance < 0 ? 'critical' : c.balance < minWalletBalance ? 'warning' : 'healthy';
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{c.phone}</div>
                    </td>
                    <td>
                      <span style={{
                        fontFamily: "'DM Mono',monospace", fontWeight: 600,
                        color: c.balance < 0 ? 'var(--red)' : c.balance < minWalletBalance ? 'var(--yellow)' : 'var(--green)',
                      }}>
                        ₹{c.balance.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--text-3)' }}>
                        🔒 ₹{(c.reservedBalance || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <ProgressBar
                        value={Math.max(0, c.balance + minWalletBalance)}
                        max={(minWalletBalance * 10) + minWalletBalance}
                        color={risk === 'critical' ? '#DC2626' : risk === 'warning' ? '#D97706' : '#16A34A'}
                      />
                    </td>
                    <td>
                      <div className="risk-indicator">
                        <div className="risk-dot" style={{ background: risk === 'critical' ? 'var(--red)' : risk === 'warning' ? 'var(--yellow)' : 'var(--green)' }} />
                        <span style={{ color: risk === 'critical' ? 'var(--red)' : risk === 'warning' ? 'var(--yellow)' : 'var(--green)' }}>
                          {risk === 'critical' ? 'Critical' : risk === 'warning' ? 'Warning' : 'Healthy'}
                        </span>
                      </div>
                    </td>
                    <td><span style={{ fontFamily: "'DM Mono',monospace" }}>{c.activeSubscriptions} active</span></td>
                    <td>
                      <Button size="sm" onClick={() => { setCreditModal(c); setCreditForm({ amount: '', reason: '' }); }}>
                        Add Credit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {creditModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCreditModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Credit — {creditModal.name}</div>
              <div className="drawer-close" style={{ marginLeft: 'auto' }} onClick={() => setCreditModal(null)}>✕</div>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Current Balance</label>
                <div style={{ fontSize: 18, fontWeight: 600, color: creditModal.balance < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{creditModal.balance.toLocaleString()}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Credit Amount</label>
                <input type="number" className="form-input" placeholder="Enter amount" min="1"
                  value={creditForm.amount}
                  onChange={e => setCreditForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input type="text" className="form-input" placeholder="e.g. Refund, Manual credit..."
                  value={creditForm.reason}
                  onChange={e => setCreditForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setCreditModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleAddCredit} disabled={creditSaving}>
                {creditSaving ? 'Saving...' : 'Add Credit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
