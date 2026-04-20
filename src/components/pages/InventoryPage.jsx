// ============================================
// FILE: components/pages/InventoryPage.jsx
// Inventory Page Component
// ============================================

import React from 'react';
import { useInventory } from '../../hooks/useInventory';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function InventoryPage() {
  const { inventory, stats, loading, error, refresh } = useInventory();

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
        Error loading inventory: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Inventory</div>
        <div className="page-sub">Today's milk demand vs available stock</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Required</div>
          <div className="kpi-value">{stats.totalRequired.toFixed(0)}L</div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>Across all products</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Available</div>
          <div className="kpi-value">{stats.totalAvailable.toFixed(0)}L</div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>In stock at hubs</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Deficit Products</div>
          <div className="kpi-value" style={{ color: stats.deficitItems > 0 ? "var(--red)" : "var(--green)" }}>
            {stats.deficitItems}
          </div>
          <div className="kpi-change" style={{ color: stats.deficitItems > 0 ? "var(--red)" : "var(--green)" }}>
            {stats.deficitItems > 0 ? "⚠ Action needed" : "✓ All covered"}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Buffer Stock</div>
          <div className="kpi-value">{stats.totalBuffer.toFixed(0)}L</div>
          <div className="kpi-change" style={{ color: "var(--text-3)" }}>Reserved for extras</div>
        </div>
      </div>

      {stats.deficitItems > 0 && (
        <div style={{ 
          padding: "10px 14px", 
          background: "var(--red-bg)", 
          border: "1px solid #FECACA", 
          borderRadius: 8, 
          marginBottom: 14, 
          display: "flex", 
          alignItems: "center", 
          gap: 10 
        }}>
          <span>⚠</span>
          <span style={{ fontSize: 12.5, color: "#991B1B" }}>
            <strong>{stats.deficitItems} products have insufficient stock.</strong> Contact procurement immediately.
          </span>
          <Button variant="danger" size="sm" style={{ marginLeft: "auto" }}>Alert Procurement</Button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 12.5 }}>
          Inventory Breakdown
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Required</th>
                <th>Available</th>
                <th>Buffer</th>
                <th>Gap</th>
                <th>Coverage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(inv => {
                const gap = inv.available - inv.required;
                const pct = Math.min(100, Math.round((inv.available / inv.required) * 100));
                return (
                  <tr key={inv.productId}>
                    <td style={{ fontWeight: 500 }}>
                      {inv.productName} <span style={{ color: "var(--text-4)", fontSize: 11 }}>({inv.unit})</span>
                    </td>
                    <td style={{ fontFamily: "'DM Mono',monospace" }}>{inv.required.toFixed(1)}L</td>
                    <td style={{ fontFamily: "'DM Mono',monospace" }}>{inv.available.toFixed(1)}L</td>
                    <td style={{ fontFamily: "'DM Mono',monospace", color: "var(--text-3)" }}>{inv.buffer.toFixed(1)}L</td>
                    <td style={{ 
                      fontFamily: "'DM Mono',monospace", 
                      color: gap >= 0 ? "var(--green)" : "var(--red)", 
                      fontWeight: 600 
                    }}>
                      {gap >= 0 ? "+" : ""}{gap.toFixed(1)}L
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar value={inv.available} max={inv.required} color={gap >= 0 ? "#16A34A" : "#DC2626"} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, width: 32 }}>{pct}%</span>
                      </div>
                    </td>
                    <td>
                      {gap >= 0 ? (
                        <span className="badge badge-green">Sufficient</span>
                      ) : (
                        <span className="badge badge-red">Deficit</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
