// ============================================
// FILE: components/pages/RoutesPage.jsx
// Route management with full stops CRUD.
// ============================================

import React, { useState } from 'react';
import { useRoutes } from '../../hooks/useRoutes';
import { useRouteStops } from '../../hooks/useRouteStops';
import { useDrivers } from '../../hooks/useDrivers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const EMPTY_ROUTE_FORM = { name: '', hub_id: '', description: '' };
const EMPTY_STOP_FORM = { name: '', address: '', map_url: '', notes: '' };

// ─── Stop Form (inline reusable) ──────────────────────────────────────────────
function StopForm({ form, onChange, onSave, onCancel, saving, error, submitLabel = 'Add Stop' }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginTop: 8 }}>
      {error && (
        <div style={{ marginBottom: 10, padding: '7px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12 }}>
          {error}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Stop Name *</label>
        <input className="form-input" placeholder="e.g. Gate 3 – Skyline Heights"
          value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Address</label>
        <input className="form-input" placeholder="e.g. 24, Residency Road..."
          value={form.address} onChange={e => onChange({ ...form, address: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Map URL <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(Google Maps / OLA link)</span></label>
        <input className="form-input" placeholder="https://maps.google.com/..."
          value={form.map_url} onChange={e => onChange({ ...form, map_url: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Delivery Notes</label>
        <input className="form-input" placeholder="e.g. Leave at gate, ring bell twice..."
          value={form.notes} onChange={e => onChange({ ...form, notes: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

// ─── Stops Drawer ─────────────────────────────────────────────────────────────
function StopsDrawer({ route, onClose }) {
  const { stops, loading, saving, addStop, updateStop, deleteStop, toggleStopActive, moveStop } = useRouteStops(route.id);
  const [addForm, setAddForm] = useState(EMPTY_STOP_FORM);
  const [addError, setAddError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_STOP_FORM);
  const [editError, setEditError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError('Stop name is required.'); return; }
    const result = await addStop(addForm);
    if (result.success) { setAddForm(EMPTY_STOP_FORM); setShowAddForm(false); setAddError(''); }
    else setAddError(result.error);
  };

  const openEdit = (stop) => {
    setEditingId(stop.id);
    setEditForm({ name: stop.name, address: stop.address || '', map_url: stop.map_url || '', notes: stop.notes || '' });
    setEditError('');
  };

  const handleEdit = async () => {
    if (!editForm.name.trim()) { setEditError('Stop name is required.'); return; }
    const stop = stops.find(s => s.id === editingId);
    const result = await updateStop(editingId, { ...editForm, sequence_order: stop?.sequence_order || 1 });
    if (result.success) { setEditingId(null); setEditError(''); }
    else setEditError(result.error);
  };

  const handleDelete = async (id) => {
    await deleteStop(id);
    setDeleteConfirm(null);
  };

  return (
    <Drawer
      title={
        <span>
          Stops — <span style={{ color: 'var(--accent)' }}>{route.name}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-4)', marginLeft: 8 }}>({route.hubName})</span>
        </span>
      }
      onClose={onClose}
      wide
    >
      {/* Route meta */}
      <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--text-3)' }}>
        {route.description ? route.description : <em>No description</em>}
        <span style={{ marginLeft: 12 }}><StatusBadge status={route.isActive ? 'active' : 'inactive'} /></span>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Loading stops...' : `${stops.length} stop${stops.length !== 1 ? 's' : ''}`}
        </div>
        {!showAddForm && (
          <Button size="sm" variant="primary" onClick={() => { setShowAddForm(true); setAddError(''); }}>
            + Add Stop
          </Button>
        )}
      </div>

      {/* Add stop form */}
      {showAddForm && (
        <StopForm
          form={addForm}
          onChange={setAddForm}
          onSave={handleAdd}
          onCancel={() => { setShowAddForm(false); setAddForm(EMPTY_STOP_FORM); setAddError(''); }}
          saving={saving}
          error={addError}
          submitLabel="Add Stop"
        />
      )}

      {/* Stops list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : stops.length === 0 && !showAddForm ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📍</div>
          No stops yet. Click <strong>+ Add Stop</strong> to create the first one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: showAddForm ? 12 : 0 }}>
          {stops.map((stop, idx) => (
            <div
              key={stop.id}
              style={{
                background: stop.is_active ? 'var(--card)' : 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                opacity: stop.is_active ? 1 : 0.6,
              }}
            >
              {editingId === stop.id ? (
                <div style={{ padding: 12 }}>
                  <StopForm
                    form={editForm}
                    onChange={setEditForm}
                    onSave={handleEdit}
                    onCancel={() => { setEditingId(null); setEditError(''); }}
                    saving={saving}
                    error={editError}
                    submitLabel="Save Changes"
                  />
                </div>
              ) : (
                <div style={{ padding: '10px 14px' }}>
                  {/* Stop header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Sequence badge */}
                    <div style={{
                      minWidth: 26, height: 26, borderRadius: '50%',
                      background: stop.is_active ? 'var(--accent)' : 'var(--border)',
                      color: stop.is_active ? '#fff' : 'var(--text-4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", flexShrink: 0, marginTop: 2,
                    }}>
                      {stop.sequence_order}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                        {stop.name}
                      </div>
                      {stop.address && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 3 }}>
                          📌 {stop.address}
                        </div>
                      )}
                      {stop.map_url && (
                        <div style={{ fontSize: 12, marginBottom: 3 }}>
                          <a href={stop.map_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={e => e.stopPropagation()}>
                            🗺 View on Map ↗
                          </a>
                        </div>
                      )}
                      {stop.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-4)', fontStyle: 'italic' }}>
                          💬 {stop.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      {/* Reorder */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          onClick={() => moveStop(stop.id, 'up')}
                          disabled={idx === 0}
                          style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--text-4)' : 'var(--text-2)', fontSize: 12 }}
                          title="Move up"
                        >↑</button>
                        <button
                          onClick={() => moveStop(stop.id, 'down')}
                          disabled={idx === stops.length - 1}
                          style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', background: 'transparent', cursor: idx === stops.length - 1 ? 'default' : 'pointer', color: idx === stops.length - 1 ? 'var(--text-4)' : 'var(--text-2)', fontSize: 12 }}
                          title="Move down"
                        >↓</button>
                      </div>
                      {/* Edit / Toggle / Delete */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        <Button size="sm" onClick={() => openEdit(stop)}>Edit</Button>
                        <Button size="sm"
                          style={{ color: stop.is_active ? 'var(--yellow)' : 'var(--green)' }}
                          onClick={() => toggleStopActive(stop.id, stop.is_active)}
                          title={stop.is_active ? 'Deactivate stop' : 'Activate stop'}
                        >
                          {stop.is_active ? '⏸' : '▶'}
                        </Button>
                        <Button size="sm" style={{ color: 'var(--red)' }} onClick={() => setDeleteConfirm(stop)}>🗑</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Stop</div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Delete <strong>"{deleteConfirm.name}"</strong>? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => handleDelete(deleteConfirm.id)}>
                Delete Stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ─── Main Routes Page ──────────────────────────────────────────────────────────
export function RoutesPage() {
  const { routes, hubs, loading, error, saving, createRoute, updateRoute, toggleRouteActive, assignDriver, refresh } = useRoutes();
  const { drivers } = useDrivers();
  const [routeModal, setRouteModal] = useState(null); // null | { mode: 'create' | 'edit', route? }
  const [routeForm, setRouteForm] = useState(EMPTY_ROUTE_FORM);
  const [routeFormError, setRouteFormError] = useState('');
  const [stopsRoute, setStopsRoute] = useState(null); // route object whose stops drawer is open
  const [assignModal, setAssignModal] = useState(null); // route object
  const [selectedDriver, setSelectedDriver] = useState('');
  const [assigning, setAssigning] = useState(false);

  useDataRefresh(refresh, 60000, true);

  const openCreate = () => { setRouteForm(EMPTY_ROUTE_FORM); setRouteFormError(''); setRouteModal({ mode: 'create' }); };
  const openEdit = (route) => {
    setRouteForm({ name: route.name, hub_id: route.hubId || '', description: route.description || '' });
    setRouteFormError('');
    setRouteModal({ mode: 'edit', route });
  };

  const handleSaveRoute = async () => {
    if (!routeForm.name.trim()) { setRouteFormError('Route name is required.'); return; }
    const payload = { name: routeForm.name, hub_id: routeForm.hub_id || null, description: routeForm.description };
    const result = routeModal.mode === 'create'
      ? await createRoute(payload)
      : await updateRoute(routeModal.route.id, payload);
    if (result.success) setRouteModal(null);
    else setRouteFormError(result.error);
  };

  const handleAssignSubmit = async () => {
    if (!selectedDriver || !assignModal) return;
    setAssigning(true);
    await assignDriver(assignModal.id, selectedDriver);
    setAssigning(false);
    setAssignModal(null);
  };

  if (loading && routes.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Routes</div>
          <div className="page-sub">{routes.length} routes configured</div>
        </div>
        <Button variant="primary" onClick={openCreate}>+ New Route</Button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Hub</th>
                <th>Description</th>
                <th>Driver Today</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                    No routes yet. Click "+ New Route" to create one.
                  </td>
                </tr>
              ) : routes.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.hubName}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 200 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description || '—'}
                    </span>
                  </td>
                  <td>
                    {r.driverName !== 'Unassigned'
                      ? <span style={{ color: 'var(--green)', fontSize: 12 }}>👤 {r.driverName}</span>
                      : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>Unassigned</span>}
                  </td>
                  <td><StatusBadge status={r.isActive ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="primary" onClick={() => setStopsRoute(r)}>
                        📍 Stops
                      </Button>
                      <Button size="sm" onClick={() => { setAssignModal(r); setSelectedDriver(r.driverId || ''); }}>Assign</Button>
                      <Button size="sm" onClick={() => openEdit(r)}>Edit</Button>
                      <Button size="sm"
                        style={{ color: r.isActive ? 'var(--red)' : 'var(--green)' }}
                        onClick={() => toggleRouteActive(r.id, r.isActive)}
                      >
                        {r.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Route create/edit modal */}
      {routeModal && (
        <Modal
          title={routeModal.mode === 'create' ? 'New Route' : `Edit Route — ${routeModal.route?.name}`}
          onClose={() => setRouteModal(null)}
          footer={
            <>
              <Button onClick={() => setRouteModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveRoute} disabled={saving}>
                {saving ? 'Saving...' : routeModal.mode === 'create' ? 'Create Route' : 'Save Changes'}
              </Button>
            </>
          }
        >
          {routeFormError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13 }}>
              {routeFormError}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Route Name *</label>
            <input className="form-input" placeholder="e.g. Sector 12 Morning"
              value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Hub</label>
            <select className="form-select" value={routeForm.hub_id}
              onChange={e => setRouteForm(p => ({ ...p, hub_id: e.target.value }))}>
              <option value="">— No Hub —</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="Brief description of coverage area..."
              value={routeForm.description}
              onChange={e => setRouteForm(p => ({ ...p, description: e.target.value }))} />
          </div>
        </Modal>
      )}

      {/* Assign Driver modal */}
      {assignModal && (
        <Modal
          title={`Assign Driver — ${assignModal.name}`}
          onClose={() => setAssignModal(null)}
          footer={
            <>
              <Button onClick={() => setAssignModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleAssignSubmit} disabled={assigning || !selectedDriver}>
                {assigning ? 'Assigning...' : 'Assign Driver'}
              </Button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Select Driver for Today</label>
            <select
              className="form-select"
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
            >
              <option value="">— Select a Driver —</option>
              {drivers.filter(d => d.status === 'active').map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {/* Stops drawer */}
      {stopsRoute && (
        <StopsDrawer route={stopsRoute} onClose={() => setStopsRoute(null)} />
      )}
    </div>
  );
}
