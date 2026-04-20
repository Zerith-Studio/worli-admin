// ============================================
// FILE: components/pages/DeliverySchedulePage.jsx
// Delivery Schedule Page Component
// ============================================

import React, { useState, useEffect } from 'react';
import { useRoutes } from '../../hooks/useRoutes';
import { useInventory } from '../../hooks/useInventory';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

export function DeliverySchedulePage() {
  const [timeLeft, setTimeLeft] = useState("02:34:17");
  const { routes } = useRoutes();
  const { inventory } = useInventory();

  useEffect(() => {
    const interval = setInterval(() => {
      // Mock countdown - in real app calculate from cutoff time
      setTimeLeft(prev => {
        const [h, m, s] = prev.split(':').map(Number);
        let total = h * 3600 + m * 60 + s - 1;
        if (total <= 0) total = 0;
        const newH = Math.floor(total / 3600);
        const newM = Math.floor((total % 3600) / 60);
        const newS = total % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(newS).padStart(2, '0')}`;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const cutoffPassed = timeLeft === "00:00:00";

  // Mock schedule data - in real app this would come from backend
  const scheduleByZone = routes.map(r => ({
    zone: r.zone,
    orders: Math.floor(Math.random() * 20) + 5,
    products: inventory.slice(0, 3).map(p => ({
      name: p.productName,
      qty: Math.floor(Math.random() * 30) + 10,
    })),
  }));

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Delivery Schedule (T+1)</div>
        <div className="page-sub">Planning for tomorrow's deliveries</div>
      </div>

      <div className="cutoff-timer">
        <span style={{ fontSize: 13 }}>⏰</span>
        <span style={{ fontSize: 12, color: "var(--yellow)", fontWeight: 500 }}>Order cutoff in</span>
        <span className="cutoff-time">{timeLeft}</span>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>— no changes after 10:00 PM</span>
        {!cutoffPassed && <Button size="sm" style={{ marginLeft: "auto" }}>Extend Cutoff</Button>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Button variant="primary">Generate Tomorrow's Orders</Button>
        <Button>Lock Schedule</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {scheduleByZone.map((z, idx) => (
          <div key={idx} className="card">
            <div className="card-title">
              📍 {z.zone}
              <span>{z.orders} orders</span>
            </div>
            {z.products.map(p => (
              <div key={p.name} className="stat-row">
                <div className="stat-label" style={{ fontSize: 12 }}>{p.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 500 }}>{p.qty}L</div>
              </div>
            ))}
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <Button size="sm">View Orders</Button>
              <Button size="sm">Assign Driver</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
