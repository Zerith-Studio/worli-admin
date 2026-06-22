// ============================================
// FILE: components/pages/AddRiderDrawer.jsx
// Drawer to promote an existing user to a rider.
// Search a user by name / phone / id, then make them a rider.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';

export function AddRiderDrawer({ onClose, searchPromotableUsers, createRider }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [vehicle, setVehicle] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const data = await searchPromotableUsers(q);
    setResults(data);
    setSearching(false);
  }, [searchPromotableUsers]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, runSearch]);

  const handleCreate = async () => {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    const result = await createRider(selected.id, vehicle);
    setSaving(false);
    if (result.success) {
      setMsg({ ok: true, text: `${selected.full_name || selected.phone_number} is now a rider ✓` });
      setTimeout(() => onClose(true), 700);
    } else {
      setMsg({ ok: false, text: `Error: ${result.error}` });
    }
  };

  return (
    <Drawer
      title="Add Rider"
      onClose={() => onClose(false)}
      footer={
        <>
          <Button onClick={() => onClose(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!selected || saving}>
            {saving ? 'Adding...' : 'Make Rider'}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12 }}>
        Search for an existing user and promote them to a rider.
      </div>

      {/* Search */}
      <div className="form-group">
        <label className="form-label">Search user (name, phone, or ID)</label>
        <input
          className="form-input"
          autoFocus
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          placeholder="e.g. Ramesh, 9876543210, or user UUID"
        />
      </div>

      {searching && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Searching…</div>}

      {!selected && results.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12, maxHeight: 260, overflowY: 'auto' }}>
          {results.map(u => (
            <div
              key={u.id}
              onClick={() => { setSelected(u); setResults([]); }}
              style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.phone_number}{u.email ? ` · ${u.email}` : ''}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontFamily: "'DM Mono',monospace" }}>{u.id}</div>
            </div>
          ))}
        </div>
      )}

      {!selected && !searching && search.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>
          No matching users found (or they are already riders).
        </div>
      )}

      {/* Selected user + vehicle */}
      {selected && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg)', borderRadius: 8, marginBottom: 14 }}>
            <div className="driver-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
              {(selected.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.full_name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{selected.phone_number}</div>
            </div>
            <Button size="sm" onClick={() => setSelected(null)}>Change</Button>
          </div>

          <div className="form-group">
            <label className="form-label">Vehicle Info <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
            <input
              className="form-input"
              value={vehicle}
              onChange={e => setVehicle(e.target.value)}
              placeholder="e.g. Honda Activa KA01AB1234"
            />
          </div>
        </div>
      )}

      {msg && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
          background: msg.ok ? 'var(--green-bg, rgba(34,197,94,0.1))' : 'var(--red-bg)',
          color: msg.ok ? 'var(--green)' : 'var(--red)',
        }}>
          {msg.text}
        </div>
      )}
    </Drawer>
  );
}
