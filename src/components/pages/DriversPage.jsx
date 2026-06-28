// ============================================
// FILE: components/pages/DriversPage.jsx
// hub_id removed from riders. Hub is derived from assigned routes.
// Route assignment uses hub→route cascade: pick hub first, then routes of that hub.
// ============================================

import React, { useState } from 'react';
import { useDrivers } from '../../hooks/useDrivers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { RIDER_STATUSES } from '../../constants';
import { supabase } from '../../lib/supabase';
import { AddRiderDrawer } from './AddRiderDrawer';

export function DriversPage() {
  const {
    drivers, routes, hubs, loading, error,
    updateDriverStatus, updateDriverVerified, updateDriverProfile,
    assignRoute, removeRoute, createRider, searchPromotableUsers, refresh,
  } = useDrivers();

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showAddRider, setShowAddRider] = useState(false);
  const [tab, setTab] = useState('profile');
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Cascaded hub→route selectors for route assignment
  const [assignHubId, setAssignHubId] = useState('');
  const [assignRouteId, setAssignRouteId] = useState('');
  // 'permanent' = standing assignment; 'override' = just today.
  const [assignMode, setAssignMode] = useState('permanent');

  // Batch rider-order assignment
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState(null);

  const handleAssignRidersToOrders = async () => {
    setAssigning(true);
    setAssignMsg(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.rpc('assign_riders_to_orders', { p_date: today });
      if (error) throw error;
      setAssignMsg({ ok: true, text: `✓ ${data?.updated ?? 0} order${data?.updated !== 1 ? 's' : ''} assigned` });
      await refresh();
    } catch (err) {
      setAssignMsg({ ok: false, text: `Error: ${err.message}` });
    } finally {
      setAssigning(false);
    }
  };

  useDataRefresh(refresh, 60000, true);

  const openDriver = (d) => {
    setSelectedDriver(d);
    setTab('profile');
    setEditForm({ full_name: d.name, phone_number: d.phone, vehicle_info: d.vehicle });
    setSaveMsg('');
    setAssignHubId('');
    setAssignRouteId('');
    setAssignMode('permanent');
  };

  const handleSaveProfile = async () => {
    if (!editForm || !selectedDriver) return;
    setSaving(true);
    const result = await updateDriverProfile(selectedDriver.id, {
      full_name: editForm.full_name,
      phone_number: editForm.phone_number,
      vehicle_info: editForm.vehicle_info,
    });
    setSaving(false);
    if (result.success) {
      setSaveMsg('Saved ✓');
      setSelectedDriver(prev => ({ ...prev, name: editForm.full_name, phone: editForm.phone_number, vehicle: editForm.vehicle_info }));
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

  const handleAssignRoute = async () => {
    if (!assignRouteId) return;
    const permanent = assignMode === 'permanent';
    const result = await assignRoute(selectedDriver.id, assignRouteId, { permanent });
    if (result.success) {
      const route = routes.find(r => r.id === assignRouteId);
      const hub = hubs.find(h => h.id === assignHubId);
      setSelectedDriver(prev => ({
        ...prev,
        assignedRoutes: [
          // Drop any existing entry of the same kind for this route, then add.
          ...(prev.assignedRoutes || []).filter(
            r => !(r.routeId === assignRouteId && r.isPermanent === permanent)
          ),
          {
            routeId: assignRouteId,
            routeName: route?.name || '—',
            hubName: hub?.name || '—',
            isPermanent: permanent,
            isOverride: !permanent,
          },
        ],
      }));
      setAssignHubId('');
      setAssignRouteId('');
    } else {
      setAssignMsg({ ok: false, text: `Error: ${result.error}` });
    }
  };

  const handleRemoveRoute = async (route) => {
    await removeRoute(selectedDriver.id, route.routeId, { permanent: route.isPermanent });
    setSelectedDriver(prev => ({
      ...prev,
      assignedRoutes: (prev.assignedRoutes || []).filter(
        r => !(r.routeId === route.routeId && r.isPermanent === route.isPermanent)
      ),
    }));
  };

  if (loading && drivers.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  // Routes this driver already owns permanently (for hiding from permanent picker)
  const permanentRouteIds = new Set(
    (selectedDriver?.assignedRoutes || []).filter(r => r.isPermanent).map(r => r.routeId)
  );

  // Routes filtered by the selected hub. For permanent assignment, hide routes
  // this driver already owns permanently. For overrides, allow any route in the
  // hub (an override can take a route over from its permanent owner).
  const filteredRoutes = routes.filter(r =>
    r.hub_id === assignHubId &&
    (assignMode === 'override' || !permanentRouteIds.has(r.id))
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="page-title">Drivers</div>
          <div className="page-sub">{drivers.length} drivers on team</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowAddRider(true)}>
              + Add Rider
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignRidersToOrders}
              disabled={assigning}
            >
              {assigning ? 'Assigning...' : '🗺 Assign Riders to Today\'s Orders'}
            </Button>
          </div>
          {assignMsg && (
            <span style={{
              fontSize: 12,
              color: assignMsg.ok ? 'var(--green)' : 'var(--red)',
              fontWeight: 500,
            }}>
              {assignMsg.text}
            </span>
          )}
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
                🏭 {d.hubName} · {d.isVerified ? '✅ Verified' : '⚠ Unverified'} · ⭐ {d.rating}
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

      {showAddRider && (
        <AddRiderDrawer
          searchPromotableUsers={searchPromotableUsers}
          createRider={createRider}
          onClose={(added) => { setShowAddRider(false); if (added) refresh(); }}
        />
      )}

      {selectedDriver && (
        <Drawer title={`Driver — ${selectedDriver.name}`} onClose={() => setSelectedDriver(null)}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Rating', val: `⭐ ${selectedDriver.rating}`, color: 'var(--yellow)' },
              { label: 'Total', val: selectedDriver.totalDeliveries },
              { label: 'Completed', val: selectedDriver.completedDeliveries, color: 'var(--green)' },
              { label: 'Failed', val: selectedDriver.failedDeliveries, color: selectedDriver.failedDeliveries > 0 ? 'var(--red)' : 'var(--text)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || 'var(--text)' }}>{s.val}</div>
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

          {/* Profile edit tab — no hub dropdown (hub is derived from routes) */}
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
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6 }}>
                💡 Hub is derived from today's assigned routes. Assign routes in the Routes tab.
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

          {/* Route assignment tab — hub → route cascade */}
          {tab === 'routes' && (() => {
            const permanentRoutes = (selectedDriver.assignedRoutes || []).filter(r => r.isPermanent);
            const overrideRoutes = (selectedDriver.assignedRoutes || []).filter(r => r.isOverride);
            const RouteRow = (r) => (
              <div key={`${r.routeId}-${r.isPermanent}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>🗺 {r.routeName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>({r.hubName})</span>
                </div>
                <Button size="sm" style={{ color: 'var(--red)' }} onClick={() => handleRemoveRoute(r)}>Remove</Button>
              </div>
            );
            return (
            <div>
              {/* Permanent (standing) routes */}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Permanent routes:</div>
              {permanentRoutes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>No permanent routes.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {permanentRoutes.map(RouteRow)}
                </div>
              )}

              {/* Today-only overrides */}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Today's override routes:</div>
              {overrideRoutes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>No overrides today.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {overrideRoutes.map(RouteRow)}
                </div>
              )}

              {/* Cascaded assignment: pick mode → hub → route */}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, marginTop: 4 }}>Assign a route:</div>

              {/* Step 0: Permanent vs Today-only */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Assignment type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="sm"
                    variant={assignMode === 'permanent' ? 'primary' : 'secondary'}
                    onClick={() => { setAssignMode('permanent'); setAssignRouteId(''); }}
                  >
                    Permanent
                  </Button>
                  <Button
                    size="sm"
                    variant={assignMode === 'override' ? 'primary' : 'secondary'}
                    onClick={() => { setAssignMode('override'); setAssignRouteId(''); }}
                  >
                    Today only
                  </Button>
                </div>
              </div>

              {/* Step 1: Hub */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>1. Select Hub</label>
                <select className="form-select" value={assignHubId}
                  onChange={e => { setAssignHubId(e.target.value); setAssignRouteId(''); }}>
                  <option value="">— Pick a hub —</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>

              {/* Step 2: Route (filtered by hub) */}
              {assignHubId && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 11 }}>2. Select Route</label>
                  {filteredRoutes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
                      {assignMode === 'permanent' ? 'No available routes for this hub.' : 'No routes for this hub.'}
                    </div>
                  ) : (
                    <select className="form-select" value={assignRouteId}
                      onChange={e => setAssignRouteId(e.target.value)}>
                      <option value="">— Pick a route —</option>
                      {filteredRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {assignRouteId && (
                <Button variant="primary" onClick={handleAssignRoute} style={{ width: '100%', marginTop: 4 }}>
                  {assignMode === 'permanent' ? 'Assign Permanent Route' : "Assign for Today"}
                </Button>
              )}
            </div>
            );
          })()}
        </Drawer>
      )}
    </div>
  );
}
