// ============================================
// FILE: components/pages/DashboardPage.jsx
// Dashboard Page Component
// ============================================

import React from 'react';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { ProgressBar } from '../ui/ProgressBar';
import { MiniChart } from '../ui/MiniChart';
import { StatusBadge } from '../ui/StatusBadge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function DashboardPage({ onNav }) {
  const {
    totalCustomers,
    activeSubscriptions,
    todayOrders,
    todayDelivered,
    todayFailed,
    todayPending,
    todayRevenue,
    atRiskCustomers,
    pausedCustomers,
    lowBalanceCount,
    deliveryPct,
    zoneStats,
    weekData,
    loading,
    error,
    refresh,
  } = useDashboardStats();

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
        Error loading dashboard: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Operations Dashboard</div>
        <div className="page-sub">
          Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Customers</div>
          <div className="kpi-value">{totalCustomers.toLocaleString()}</div>
          <div className="kpi-change" style={{ color: 'var(--text-3)' }}>Registered users</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Subscriptions</div>
          <div className="kpi-value">{activeSubscriptions.toLocaleString()}</div>
          <div className="kpi-change" style={{ color: 'var(--text-3)' }}>Currently active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Today's Deliveries</div>
          <div className="kpi-value">{todayOrders.toLocaleString()}</div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>
            {todayDelivered} done · {todayFailed} failed · {todayPending} pending
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Today's Revenue</div>
          <div className="kpi-value">₹{todayRevenue.toLocaleString()}</div>
          <div className="kpi-change" style={{ color: 'var(--text-3)' }}>From delivered orders</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">
            Delivery Progress
            <span>{deliveryPct}% complete</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <ProgressBar value={todayDelivered} max={todayOrders || 1} color="#16A34A" />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
              <span>✓ {todayDelivered} Delivered</span>
              <span style={{ color: "var(--red)" }}>✗ {todayFailed} Failed</span>
              <span>○ {todayPending} Pending</span>
            </div>
          </div>
          {zoneStats.map(z => (
            <div key={z.zone} className="stat-row">
              <div className="stat-label">{z.zone.replace(" Bengaluru", "")}</div>
              <div className="stat-bar">
                <ProgressBar value={z.done} max={Math.max(z.total, 1)} color={z.done === z.total ? "#16A34A" : "#1A6FE8"} />
              </div>
              <div className="stat-val">{z.done}/{z.total}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">
            Weekly Deliveries
            <span>Last 7 days</span>
          </div>
          <MiniChart data={weekData} color="#1A6FE8" />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-4)" }}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span style={{ color: "var(--accent)" }}>Today</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div className="card">
          <div className="card-title">🚨 Alerts</div>
          <div className="scroll-fade">
            {lowBalanceCount > 0 && (
              <div className="alert-item" style={{ background: "var(--red-bg)" }}>
                <div className="alert-icon">⚠</div>
                <div className="alert-text">
                  <strong>{lowBalanceCount} customers with negative wallet balance</strong>
                  Deliveries may be auto-paused
                </div>
              </div>
            )}
            {atRiskCustomers > 0 && (
              <div className="alert-item" style={{ background: "var(--yellow-bg)" }}>
                <div className="alert-icon">⚡</div>
                <div className="alert-text">
                  <strong>{atRiskCustomers} customers at risk</strong>
                  Wallet balance below ₹200 threshold
                </div>
              </div>
            )}
            {todayFailed > 0 && (
              <div className="alert-item" style={{ background: "var(--red-bg)" }}>
                <div className="alert-icon">❌</div>
                <div className="alert-text">
                  <strong>{todayFailed} deliveries failed today</strong>
                  Action required — retry or issue refund
                </div>
              </div>
            )}
            <div className="alert-item" style={{ background: "var(--yellow-bg)" }}>
              <div className="alert-icon">⏰</div>
              <div className="alert-text">
                <strong>Order modification cutoff active</strong>
                {activeSubscriptions} subscriptions will be locked after tonight's cutoff
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
