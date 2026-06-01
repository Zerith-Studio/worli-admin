// ============================================
// FILE: components/pages/AssetTrackingPage.jsx
// Asset Tracking Page Component
// ============================================

import React from 'react';
import { useAssets } from '../../hooks/useAssets';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusBadge } from '../ui/StatusBadge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function AssetTrackingPage() {
  const { assets, rawReturns, stats, loading, error, refresh } = useAssets();

  useDataRefresh(refresh, 60000, true);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>
        Error loading assets: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Asset Tracking</div>
        <div className="page-sub">Glass bottle and crate ledger</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Issued</div>
          <div className="kpi-value">🍶 {stats.totalIssued}</div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>All time</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Returned</div>
          <div className="kpi-value" style={{ color: "var(--green)" }}>🍶 {stats.totalReturned}</div>
          <div className="kpi-change kpi-up">Good return rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Return</div>
          <div className="kpi-value" style={{ color: stats.totalPending > 100 ? "var(--red)" : "var(--yellow)" }}>
            🍶 {stats.totalPending}
          </div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>With customers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High Overdue</div>
          <div className="kpi-value" style={{ color: "var(--red)" }}>{stats.highOverdue}</div>
          <div className="kpi-change kpi-down">More than 3 bottles out</div>
        </div>
      </div>

      {stats.highOverdue > 0 && (
        <div style={{ 
          padding: "10px 14px", 
          background: "var(--yellow-bg)", 
          border: "1px solid #FDE68A", 
          borderRadius: 8, 
          marginBottom: 14 
        }}>
          <span style={{ fontSize: 12.5, color: "#92400E" }}>
            ⚡ {stats.highOverdue} customers have 3+ bottles pending. Send reminder to recover assets.
          </span>
        </div>
      )}

      {rawReturns?.some(r => r.status === 'requested') && (
        <div className="card" style={{ padding: 0, marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
            Pending Return Requests
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Quantity</th>
                  <th>Date</th>
                  <th>Route / Stop</th>
                </tr>
              </thead>
              <tbody>
                {rawReturns.filter(r => r.status === 'requested').map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>
                      {r.users?.full_name}
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.users?.phone_number}</div>
                    </td>
                    <td><span style={{ fontWeight: 600 }}>🍶 {r.quantity}</span></td>
                    <td>{new Date(r.return_date).toLocaleDateString()}</td>
                    <td>
                      {r.routes?.name ? (
                        <>
                          <div style={{ fontWeight: 500 }}>{r.routes?.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.route_stops?.name}</div>
                        </>
                      ) : (
                        <span style={{ color: "var(--orange)", fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Zone</th>
                <th>Issued</th>
                <th>Returned</th>
                <th>Pending</th>
                <th>Return Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-3)" }}>{a.zone}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace" }}>{a.issued}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace", color: "var(--green)" }}>{a.returned}</td>
                  <td style={{ 
                    fontFamily: "'DM Mono',monospace", 
                    color: a.pending > 3 ? "var(--red)" : "var(--text)" 
                  }}>
                    {a.pending}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 60 }}>
                        <ProgressBar 
                          value={a.returnRate} 
                          max={100} 
                          color={a.returnRate > 70 ? "#16A34A" : a.returnRate > 40 ? "#D97706" : "#DC2626"} 
                        />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{a.returnRate}%</span>
                    </div>
                  </td>
                  <td>
                    {a.risk === "high" ? (
                      <StatusBadge status="failed" />
                    ) : a.risk === "medium" ? (
                      <StatusBadge status="at_risk" />
                    ) : (
                      <StatusBadge status="active" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
