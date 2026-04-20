// ============================================
// FILE: components/pages/DriversPage.jsx
// Drivers Page Component
// ============================================

import React, { useState } from 'react';
import { useDrivers } from '../../hooks/useDrivers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { MiniChart } from '../ui/MiniChart';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { RIDER_STATUSES } from '../../constants';

export function DriversPage() {
  const { drivers, loading, error, updateDriverStatus, refresh } = useDrivers();
  const [selectedDriver, setSelectedDriver] = useState(null);

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
        Error loading drivers: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div className="page-title">Drivers</div>
          <div className="page-sub">{drivers.length} drivers on team</div>
        </div>
        <Button variant="primary">+ Add Driver</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {drivers.map(d => (
          <div 
            key={d.id} 
            className="driver-card" 
            onClick={() => setSelectedDriver(d)} 
            style={{ cursor: "pointer" }}
          >
            <div className="driver-avatar">
              {d.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                <StatusBadge status={d.status} />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6 }}>
                📱 {d.phone} · 🚗 {d.vehicle}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>📍 {d.zone}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: "var(--text)" }}>
                    {d.deliveries}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>Total Deliveries</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: "var(--green)" }}>
                    ⭐ {d.rating}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>Rating</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: "var(--accent)" }}>
                    {d.isVerified ? '✓' : '○'}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>Verified</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDriver && (
        <Drawer 
          title={`Driver — ${selectedDriver.name}`} 
          onClose={() => setSelectedDriver(null)}
        >
          <div style={{ 
            background: "var(--bg)", 
            padding: 16, 
            borderRadius: 8, 
            marginBottom: 16, 
            display: "flex", 
            gap: 12, 
            alignItems: "center" 
          }}>
            <div className="driver-avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
              {selectedDriver.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{selectedDriver.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{selectedDriver.phone}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 1 }}>
                {selectedDriver.vehicle} · {selectedDriver.zone}
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <StatusBadge status={selectedDriver.status} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Total Deliveries", val: selectedDriver.deliveries },
              { label: "Rating", val: `⭐ ${selectedDriver.rating}` },
              { label: "Verified", val: selectedDriver.isVerified ? 'Yes' : 'No' },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  fontFamily: "'DM Mono',monospace", 
                  color: "var(--text)" 
                }}>
                  {s.val}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>Weekly Performance</div>
            <MiniChart data={[34, 28, 41, 38, 45, 32, 22]} color="#1A6FE8" />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10.5, color: "var(--text-4)" }}>
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Today</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button 
              variant="primary"
              onClick={() => updateDriverStatus(selectedDriver.id, 'active')}
            >
              Set Active
            </Button>
            <Button 
              onClick={() => updateDriverStatus(selectedDriver.id, 'on_leave')}
            >
              Set On Leave
            </Button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
