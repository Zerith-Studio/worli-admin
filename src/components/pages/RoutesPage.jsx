// ============================================
// FILE: components/pages/RoutesPage.jsx
// Full CRUD: Add Route modal (name, hub, description),
// edit, toggle active, view driver assignment.
// ============================================

import React, { useState } from 'react';
import { useRoutes } from '../../hooks/useRoutes';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const EMPTY_FORM = { name: '', hub_id: '', description: '' };

export function RoutesPage() {
  const { routes, hubs, loading, error, saving, createRoute, updateRoute, toggleRouteActive, refresh } = useRoutes();
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', route? }
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  useDataRefresh(refresh, 60000, true);

  const openCreate = () => { setForm(EMPTY_FORM); setFormError(''); setModal({ mode: 'create' }); };
  const openEdit = (route) => {
    setForm({ name: route.name, hub_id: route.hubId || '', description: route.description || '' });
    setFormError('');
    setModal({ mode: 'edit', route });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Route name is required.'); return; }
    const payload = { name: form.name, hub_id: form.hub_id || null, description: form.description };
    const result = modal.mode === 'create'
      ? await createRoute(payload)
      : await updateRoute(modal.route.id, payload);
    if (result.success) setModal(null);
    else setFormError(result.error);
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
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                  No routes yet. Click "+ New Route" to create one.
                </td></tr>
              ) : routes.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.hubName}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.description || '—'}</td>
                  <td>
                    <span style={{ fontSize: 12 }}>
                      {r.driverName !== 'Unassigned'
                        ? <span style={{ color: 'var(--green)' }}>👤 {r.driverName}</span>
                        : <span style={{ color: 'var(--text-4)' }}>Unassigned</span>}
                    </span>
                  </td>
                  <td><StatusBadge status={r.isActive ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => openEdit(r)}>Edit</Button>
                      <Button
                        size="sm"
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

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'New Route' : `Edit Route — ${modal.route?.name}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal.mode === 'create' ? 'Create Route' : 'Save Changes'}
              </Button>
            </>
          }
        >
          {formError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13 }}>
              {formError}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Route Name *</label>
            <input className="form-input" placeholder="e.g. Sector 12 Morning" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Hub</label>
            <select className="form-select" value={form.hub_id}
              onChange={e => setForm(p => ({ ...p, hub_id: e.target.value }))}>
              <option value="">— No Hub —</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="Brief description of coverage area..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
