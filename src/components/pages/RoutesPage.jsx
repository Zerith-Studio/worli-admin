// ============================================
// FILE: components/pages/RoutesPage.jsx
// Routes Page Component
// ============================================

import React, { useState } from 'react';
import { useRoutes } from '../../hooks/useRoutes';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { ProgressBar } from '../ui/ProgressBar';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function RoutesPage() {
  const { routes, loading, error, refresh } = useRoutes();
  const [selectedRoute, setSelectedRoute] = useState(null);

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
        Error loading routes: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="page-title">Routes</div>
          <div className="page-sub">{routes.length} routes configured</div>
        </div>
        <Button variant="primary">+ New Route</Button>
      </div>

      <div className="grid-2">
        <div>
          {routes.map(r => (
            <div 
              key={r.id} 
              className="card" 
              style={{ 
                marginBottom: 10, 
                cursor: "pointer", 
                border: selectedRoute?.id === r.id ? "2px solid var(--accent)" : "1px solid var(--border)" 
              }} 
              onClick={() => setSelectedRoute(r)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Route {r.name}</div>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>{r.zone}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--text-3)" }}>
                <span>🛑 {r.stops} stops</span>
                <span>👤 {r.driverName || "Unassigned"}</span>
              </div>
              <ProgressBar 
                value={r.status === "completed" ? r.stops : r.status === "in_progress" ? Math.floor(r.stops * 0.6) : 0} 
                max={r.stops || 1} 
                color={r.status === "completed" ? "#16A34A" : "#1A6FE8"} 
              />
              <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>
                {r.status === "completed" 
                  ? `All ${r.stops} stops done` 
                  : r.status === "in_progress" 
                    ? `${Math.floor(r.stops * 0.6)}/${r.stops} stops complete` 
                    : "Not started"
                }
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="map-placeholder">
            <div className="map-pin">🗺️</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
              {selectedRoute ? `Route ${selectedRoute.name} — ${selectedRoute.zone}` : "Select a route to view map"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-4)" }}>
              {selectedRoute ? `${selectedRoute.stops} delivery stops` : "Map integration placeholder"}
            </div>
            {selectedRoute && (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Button size="sm" variant="primary">View Stops</Button>
                <Button size="sm">Reassign Driver</Button>
              </div>
            )}
          </div>

          {selectedRoute && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">Route Details — {selectedRoute.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                <p><strong>Zone:</strong> {selectedRoute.zone}</p>
                <p><strong>Stops:</strong> {selectedRoute.stops}</p>
                <p><strong>Driver:</strong> {selectedRoute.driverName || "Unassigned"}</p>
                <p><strong>Status:</strong> <StatusBadge status={selectedRoute.status} /></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
