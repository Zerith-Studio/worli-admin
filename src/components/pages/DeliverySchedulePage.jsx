// ============================================
// FILE: components/pages/DeliverySchedulePage.jsx
// Delivery Schedule Page Component
// ============================================

import React, { useState, useEffect } from 'react';
import { useRoutes } from '../../hooks/useRoutes';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

export function DeliverySchedulePage() {
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const { routes } = useRoutes();
  const { getSetting, loading: settingsLoading } = useSettings();

  const cutoffTimeSetting = getSetting('order_modification_cutoff_time', '19:00');

  useEffect(() => {
    if (settingsLoading) return;

    const interval = setInterval(() => {
      const now = new Date();
      const [hours, minutes] = cutoffTimeSetting.split(':').map(Number);
      
      const cutoffDate = new Date(now);
      cutoffDate.setHours(hours, minutes, 0, 0);

      // If we are past the cutoff, it's 0
      let diffSeconds = Math.floor((cutoffDate - now) / 1000);
      
      if (diffSeconds <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diffSeconds / 3600);
      const m = Math.floor((diffSeconds % 3600) / 60);
      const s = diffSeconds % 60;
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [cutoffTimeSetting, settingsLoading]);

  const cutoffPassed = timeLeft === "00:00:00";

  // Mock schedule data - in real app this would come from backend
  const scheduleByZone = routes.map(r => ({
    zone: r.zone,
    orders: Math.floor(Math.random() * 20) + 5,
    products: [
      { name: "Fresh Milk 500ml", qty: Math.floor(Math.random() * 30) + 10 }
    ],
  }));

  const formatAMPM = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hours = h % 12 || 12;
    return `${hours}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

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
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>— no changes after {formatAMPM(cutoffTimeSetting)}</span>
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
