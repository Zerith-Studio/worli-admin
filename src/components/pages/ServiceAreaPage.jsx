// ============================================
// FILE: components/pages/ServiceAreaPage.jsx
// Manage serviceable pincodes (where the consumer app is available)
// and the global serviceability gate toggle.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Toggle } from '../ui/Toggle';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function ServiceAreaPage() {
  const [pincodes, setPincodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gateEnabled, setGateEnabled] = useState(true);

  const [form, setForm] = useState({ pincode: '', area_name: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: pins, error: pinErr }, { data: setting }] = await Promise.all([
        supabase.from('serviceable_pincodes').select('*').order('pincode'),
        supabase.from('app_settings').select('setting_value').eq('setting_key', 'serviceability_check_enabled').maybeSingle(),
      ]);
      if (pinErr) throw pinErr;
      setPincodes(pins || []);
      setGateEnabled(String(setting?.setting_value ?? 'true').toLowerCase() === 'true');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    const pin = form.pincode.trim();
    if (!/^\d{6}$/.test(pin)) { setFormError('Pincode must be exactly 6 digits.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const { error: err } = await supabase.from('serviceable_pincodes').insert({
        pincode: pin,
        area_name: form.area_name.trim() || null,
        is_active: true,
      });
      if (err) throw err;
      setForm({ pincode: '', area_name: '' });
      await fetchData();
    } catch (err) {
      setFormError(err.message.includes('duplicate') ? 'This pincode is already in the list.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePincode = async (row) => {
    await supabase.from('serviceable_pincodes').update({ is_active: !row.is_active }).eq('id', row.id);
    await fetchData();
  };

  const deletePincode = async (row) => {
    if (!window.confirm(`Remove pincode ${row.pincode}?`)) return;
    await supabase.from('serviceable_pincodes').delete().eq('id', row.id);
    await fetchData();
  };

  const toggleGate = async (next) => {
    setGateEnabled(next);
    await supabase.from('app_settings')
      .upsert({ setting_key: 'serviceability_check_enabled', setting_value: next ? 'true' : 'false' }, { onConflict: 'setting_key' });
  };

  if (loading && pincodes.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Service Area</div>
        <div className="page-sub">{pincodes.length} pincodes · {pincodes.filter(p => p.is_active).length} active</div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--red-bg)', color: '#991B1B' }}>Error: {error}</div>
      )}

      {/* Global toggle */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Serviceability Gate</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, maxWidth: 560 }}>
            When ON, the consumer app asks for a pincode on open and blocks areas not in the active list below.
            While the list is empty the app stays open to everyone regardless of this setting.
          </div>
        </div>
        <Toggle checked={gateEnabled} onChange={toggleGate} />
      </div>

      {/* Add form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Add Serviceable Pincode</div>
        {formError && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 13 }}>{formError}</div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Pincode *</label>
            <input
              className="form-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="400018"
              value={form.pincode}
              onChange={e => setForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">Area Name (optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Worli"
              value={form.area_name}
              onChange={e => setForm(p => ({ ...p, area_name: e.target.value }))}
            />
          </div>
          <Button variant="primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Adding...' : '+ Add Pincode'}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pincode</th>
                <th>Area</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pincodes.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                  No serviceable pincodes yet. The app is open to everyone until you add one.
                </td></tr>
              ) : pincodes.map(row => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{row.pincode}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{row.area_name || '—'}</td>
                  <td><StatusBadge status={row.is_active ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => togglePincode(row)}>
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" style={{ color: 'var(--red)' }} onClick={() => deletePincode(row)}>Remove</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
