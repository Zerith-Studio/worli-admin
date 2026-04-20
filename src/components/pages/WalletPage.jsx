// ============================================
// FILE: components/pages/WalletPage.jsx
// Wallet Page Component
// ============================================

import React, { useState } from 'react';
import { useWalletStats } from '../../hooks/useWalletStats';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const RISK_LEVELS = [
  { value: 'all', label: 'All Balances' },
  { value: 'negative', label: 'Negative Balance' },
  { value: 'low', label: 'Low (<₹200)' },
  { value: 'healthy', label: 'Healthy' },
];

export function WalletPage() {
  const {
    customers,
    stats,
    loading,
    error,
    filters,
    updateFilters,
    addCredit,
    refresh,
  } = useWalletStats();

  const [creditModal, setCreditModal] = useState(null);

  useDataRefresh(refresh, 60000, true);

  if (loading && customers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>
        Error loading wallet data: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Wallet & Payments</div>
        <div className="page-sub">Customer wallet balances and risk indicators</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Wallet Balance</div>
          <div className="kpi-value" style={{ color: stats.totalBalance > 0 ? "var(--green)" : "var(--red)" }}>
            ₹{stats.totalBalance.toLocaleString()}
          </div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>Across all customers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Negative Balance</div>
          <div className="kpi-value" style={{ color: "var(--red)" }}>{stats.negativeCount}</div>
          <div className="kpi-change kpi-down">Auto-pause candidates</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">At Risk (&lt;₹200)</div>
          <div className="kpi-value" style={{ color: "var(--yellow)" }}>{stats.atRiskCount}</div>
          <div className="kpi-change" style={{ color: "var(--yellow)" }}>⚡ Recharge reminder needed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Healthy Balance</div>
          <div className="kpi-value" style={{ color: "var(--green)" }}>{stats.healthyCount}</div>
          <div className="kpi-change kpi-up">✓ No action needed</div>
        </div>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search customer..."
          value={filters.search}
          onChange={(value) => updateFilters({ search: value })}
        />
        <Select
          value={filters.riskLevel}
          onChange={(value) => updateFilters({ riskLevel: value })}
          options={RISK_LEVELS}
        />
        <Button variant="primary">Send Recharge Reminder</Button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Zone</th>
                <th>Wallet Balance</th>
                <th>Balance Bar</th>
                <th>Risk Level</th>
                <th>Subscription</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const risk = c.balance < 0 ? "critical" : c.balance < 200 ? "warning" : "healthy";
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-3)" }}>{c.zone}</td>
                    <td>
                      <span style={{ 
                        fontFamily: "'DM Mono',monospace", 
                        fontWeight: 600, 
                        color: c.balance < 0 ? "var(--red)" : c.balance < 200 ? "var(--yellow)" : "var(--green)" 
                      }}>
                        ₹{c.balance.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <ProgressBar
                        value={Math.max(0, c.balance + 200)}
                        max={2200}
                        color={risk === "critical" ? "#DC2626" : risk === "warning" ? "#D97706" : "#16A34A"}
                      />
                    </td>
                    <td>
                      <div className="risk-indicator">
                        <div 
                          className="risk-dot" 
                          style={{ 
                            background: risk === "critical" ? "var(--red)" : risk === "warning" ? "var(--yellow)" : "var(--green)" 
                          }} 
                        />
                        <span style={{ 
                          color: risk === "critical" ? "var(--red)" : risk === "warning" ? "var(--yellow)" : "var(--green)" 
                        }}>
                          {risk === "critical" ? "Critical" : risk === "warning" ? "Warning" : "Healthy"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'DM Mono',monospace" }}>{c.activeSubscriptions} active</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Button size="sm" onClick={() => setCreditModal(c)}>Add Credit</Button>
                        {risk !== "healthy" && <Button size="sm" style={{ color: "var(--yellow)" }}>Remind</Button>}
                      </div>
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
              <div className="modal-title">Add Credit - {creditModal.name}</div>
              <div className="drawer-close" style={{ marginLeft: "auto" }} onClick={() => setCreditModal(null)}>✕</div>
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
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Enter amount" 
                  min="1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Refund, Manual credit..." 
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setCreditModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                addCredit(creditModal.id, 100);
                setCreditModal(null);
              }}>
                Add Credit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
