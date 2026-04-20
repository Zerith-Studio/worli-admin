// ============================================
// FILE: components/pages/DemandForecastPage.jsx
// Demand Forecast Page Component
// ============================================

import React from 'react';
import { useInventory } from '../../hooks/useInventory';
import { ProgressBar } from '../ui/ProgressBar';
import { MiniChart } from '../ui/MiniChart';

export function DemandForecastPage() {
  const { inventory } = useInventory();

  // Mock demand data - in real app this would come from analytics
  const productDemand = inventory.map(p => ({
    ...p,
    demand: p.required,
    revenue: p.required * 28, // Mock price
  }));

  const maxDemand = Math.max(...productDemand.map(p => p.demand), 1);

  // Mock zone data
  const zones = ['North', 'South', 'East', 'West', 'Central'];
  const zoneDemand = zones.map(zone => ({
    zone,
    total: Math.floor(Math.random() * 50) + 20,
    revenue: Math.floor(Math.random() * 5000) + 2000,
  }));

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Demand Forecast</div>
        <div className="page-sub">Product-wise demand for tomorrow's deliveries</div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Demand by Product</div>
          {productDemand.map(p => (
            <div key={p.productId} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {p.productName} <span style={{ color: "var(--text-4)", fontWeight: 400 }}>({p.unit})</span>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, fontWeight: 600 }}>
                  {p.demand} units
                </div>
              </div>
              <ProgressBar value={p.demand} max={maxDemand} color="#1A6FE8" />
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                Est. revenue: <strong>₹{p.revenue.toLocaleString()}</strong>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Zone-wise Demand</div>
          {zoneDemand.map(z => (
            <div key={z.zone} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{z.zone}</div>
                <div>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{z.total} pkts</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>₹{z.revenue.toLocaleString()}/day</span>
                </div>
              </div>
              <ProgressBar value={z.total} max={150} color="#1A6FE8" />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">7-Day Demand Trend</div>
        <div style={{ display: "flex", gap: 16, paddingTop: 8 }}>
          {[
            ["Mon", "Full Cream", { daily: [28, 32, 30, 35, 31, 29, 33] }],
            ["", "Toned", { daily: [18, 20, 19, 22, 20, 17, 21] }],
            ["", "Double Toned", { daily: [12, 11, 14, 13, 12, 11, 13] }],
          ].map(([, label, data], i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6, fontWeight: 500 }}>
                {label}
              </div>
              <MiniChart data={data?.daily || [10, 12, 11, 13, 12, 11, 12]} color="#1A6FE8" />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 6, fontSize: 10.5, color: "var(--text-4)" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Tomorrow"].map(d => <span key={d}>{d}</span>)}
        </div>
      </div>
    </div>
  );
}
