// ============================================
// FILE: components/pages/DriversPage.jsx
// Rewritten: profile editing, verified toggle, route assignment,
// real delivery stats. Removed rating + weekly performance chart.
// ============================================

import React, { useState } from 'react';
import { useDrivers } from '../../hooks/useDrivers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { RIDER_STATUSES } from '../../constants';

export function DriversPage() {
  const {
    drivers, routes, hubs, loading, error,
    updateDriverStatus, updateDriverVerified, updateDriverProfile,
    assignRoute, removeRoute, refresh,
  } = useDrivers();

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [tab, setTab] = useState('profile');
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useDataRefresh(refresh, 60000, true);

  const openDriver = (d) => {
    setSelectedDriver(d);
    setTab('profile');
    setEditForm({ full_name: d.name, phone_number: d.phone, vehicle_info: d.vehicle, hub_id: d.hubId || '' });
    setSaveMsg('');
  };

  const handleSaveProfile = async () => {
    if (!editForm || !selectedDriver) return;
    setSaving(true);
    const result = await updateDriverProfile(selectedDriver.id, {
      full_name: editForm.full_name,
      phone_number: editForm.phone_number,
      vehicle_info: editForm.vehicle_info,
      hub_id: editForm.hub_id || null,
    });
    setSaving(false);
    if (result.success) {
      setSaveMsg('Saved ✓');
      // Update local selectedDriver
      setSelectedDriver(prev => ({ ...prev, name: editForm.full_name, phone: editForm.phone_number, vehicle: editForm.vehicle_info, hubId: editForm.hub_id }));
    } else {
      setSaveMsg(`Error: ${result.error}`);
    }
  };

  const handleStatusChange = async (newStatus) => {
    await updateDriverStatus(selectedDriver.id, newStatus);
    setSelectedDriver(prev => ({ ...prev, status: newStatus }));
  };

  const handleVerifiedToggle = async () => {
    const newVal = !selectedDriver.isVerified;
    await updateDriverVerified(selectedDriver.id, newVal);
    setSelectedDriver(prev => ({ ...prev, isVerified: newVal }));
  };

  const handleAssignRoute = async (routeId) => {
    await assignRoute(selectedDriver.id, routeId);
    // Refresh driver list to get updated routes
    await refresh();
    // Update local selectedDriver routes
    const route = routes.find(r => r.id === routeId);
    if (route) {
      setSelectedDriver(prev => ({
        ...prev,
        assignedRoutes: [...(prev.assignedRoutes || []), { routeId, routeName: route.name }],
      }));
    }
  };

  const handleRemoveRoute = async (routeId) => {
    await removeRoute(selectedDriver.id, routeId);
    setSelectedDriver(prev => ({
      ...prev,
      assignedRoutes: prev.assignedRoutes.filter(r => r.routeId !== routeId),
    }));
  };

  if (loading && drivers.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  const unassignedRoutes = routes.filter(r =>
    !selectedDriver?.assignedRoutes?.some(ar => ar.routeId === r.id)
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Drivers</div>
          <div className="page-sub">{drivers.length} drivers on team</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {drivers.length === 0 ? (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-4)' }}>
            No drivers found. Add riders via the database.
          </div>
        ) : drivers.map(d => (
          <div
            key={d.id}
            className="driver-card"
            onClick={() => openDriver(d)}
            style={{ cursor: 'pointer' }}
          >
            <div className="driver-avatar">
              {d.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                <StatusBadge status={d.status} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4 }}>
                📱 {d.phone} · 🚗 {d.vehicle}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>
                🏭 {d.hubName} · {d.isVerified ? '✅ Verified' : '⚠ Unverified'}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{d.totalDeliveries}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: 'var(--green)' }}>{d.completedDeliveries}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>Done</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: 'var(--red)' }}>{d.failedDeliveries}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>Failed</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDriver && (
        <Drawer title={`Driver — ${selectedDriver.name}`} onClose={() => setSelectedDriver(null)}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Total Deliveries', val: selectedDriver.totalDeliveries },
              { label: 'Completed', val: selectedDriver.completedDeliveries, color: 'var(--green)' },
              { label: 'Failed', val: selectedDriver.failedDeliveries, color: selectedDriver.failedDeliveries > 0 ? 'var(--red)' : 'var(--text)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || 'var(--text)' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {['profile', 'status', 'routes'].map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {/* Profile edit tab */}
          {tab === 'profile' && editForm && (
            <div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={editForm.full_name}
                  onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" value={editForm.phone_number}
                  onChange={e => setEditForm(p => ({ ...p, phone_number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Info</label>
                <input className="form-input" placeholder="e.g. Honda Activa KA01AB1234" value={editForm.vehicle_info}
                  onChange={e => setEditForm(p => ({ ...p, vehicle_info: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Hub</label>
                <select className="form-select" value={editForm.hub_id}
                  onChange={e => setEditForm(p => ({ ...p, hub_id: e.target.value }))}>
                  <option value="">— Unassigned —</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <Button variant="primary" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
                {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith('Error') ? 'var(--red)' : 'var(--green)' }}>{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* Status & verified tab */}
          {tab === 'status' && (
            <div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {RIDER_STATUSES.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={selectedDriver.status === s.value ? 'primary' : 'secondary'}
                      onClick={() => handleStatusChange(s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Verification</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: 13 }}>
                    {selectedDriver.isVerified ? '✅ Verified' : '⚠ Not Verified'}
                  </span>
                  <Button
                    size="sm"
                    style={{ color: selectedDriver.isVerified ? 'var(--red)' : 'var(--green)' }}
                    onClick={handleVerifiedToggle}
                  >
                    {selectedDriver.isVerified ? 'Mark Unverified' : 'Mark Verified'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Route assignment tab */}
          {tab === 'routes' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Today's assigned routes:</div>
              {(selectedDriver.assignedRoutes || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>No routes assigned today.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {selectedDriver.assignedRoutes.map(r => (
                    <div key={r.routeId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>🗺 {r.routeName}</span>
                      <Button size="sm" style={{ color: 'var(--red)' }} onClick={() => handleRemoveRoute(r.routeId)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}

              {unassignedRoutes.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Assign a route:</div>
                  <select className="form-select" defaultValue=""
                    onChange={async e => { if (e.target.value) { await handleAssignRoute(e.target.value); e.target.value = ''; } }}>
                    <option value="">— Pick a route —</option>
                    {unassignedRoutes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.hubs?.name || 'No Hub'})</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
