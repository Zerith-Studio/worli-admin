// ============================================
// FILE: components/pages/HubsPage.jsx
// NEW: Hub management — list, create, edit, toggle active.
// ============================================

import React, { useState } from 'react';
import { useHubs } from '../../hooks/useHubs';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const EMPTY_FORM = { name: '', address: '', contact_number: '' };

export function HubsPage() {
  const { hubs, loading, error, saving, createHub, updateHub, toggleHubActive, refresh } = useHubs();
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', hub?: {} }
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  useDataRefresh(refresh, 60000, true);

  const openCreate = () => { setForm(EMPTY_FORM); setFormError(''); setModal({ mode: 'create' }); };
  const openEdit = (hub) => { setForm({ name: hub.name, address: hub.address || '', contact_number: hub.contact_number || '' }); setFormError(''); setModal({ mode: 'edit', hub }); };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Hub name is required.'); return; }
    const payload = { name: form.name, address: form.address, contact_number: form.contact_number };
    const result = modal.mode === 'create'
      ? await createHub(payload)
      : await updateHub(modal.hub.id, payload);
    if (result.success) { setModal(null); }
    else { setFormError(result.error); }
  };

  if (loading && hubs.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Hubs</div>
          <div className="page-sub">{hubs.length} fulfillment hubs</div>
        </div>
        <Button variant="primary" onClick={openCreate}>+ Add Hub</Button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hub Name</th>
                <th>Address</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hubs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                  No hubs yet. Click "+ Add Hub" to create one.
                </td></tr>
              ) : hubs.map(hub => (
                <tr key={hub.id}>
                  <td style={{ fontWeight: 600 }}>{hub.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{hub.address || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: "'DM Mono',monospace" }}>{hub.contact_number || '—'}</td>
                  <td><StatusBadge status={hub.is_active ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => openEdit(hub)}>Edit</Button>
                      <Button
                        size="sm"
                        style={{ color: hub.is_active ? 'var(--red)' : 'var(--green)' }}
                        onClick={() => toggleHubActive(hub.id, hub.is_active)}
                      >
                        {hub.is_active ? 'Deactivate' : 'Activate'}
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
          title={modal.mode === 'create' ? 'Add Hub' : `Edit Hub — ${modal.hub?.name}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal.mode === 'create' ? 'Create Hub' : 'Save Changes'}
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
            <label className="form-label">Hub Name *</label>
            <input className="form-input" placeholder="e.g. Koramangala Hub" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-input" placeholder="Full address..." style={{ height: 72, paddingTop: 8, resize: 'vertical' }}
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Number</label>
            <input className="form-input" placeholder="+91 XXXXX XXXXX" value={form.contact_number}
              onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
