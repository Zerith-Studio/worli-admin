// ============================================
// FILE: components/pages/ServiceAreaPage.jsx
// Manage serviceable pincodes (where the consumer app is available)
// and the global serviceability gate toggle.
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Toggle } from '../ui/Toggle';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LoadMore } from '../ui/LoadMore';
import { RowsPerLoad } from '../ui/RowsPerLoad';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';

export function ServiceAreaPage() {
  const [gateEnabled, setGateEnabled] = useState(true);

  const [form, setForm] = useState({ pincode: '', area_name: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    rows: pincodes,
    loading,
    error,
    totalCount, loadingMore, loadMore,
    refresh: fetchData,
  } = usePaginatedQuery({
    table: 'serviceable_pincodes',
    select: '*',
    orderBy: { column: 'pincode', ascending: true },
  });

  // The gate lives in app_settings, not in the paginated list, so it loads on
  // its own rather than riding along with a page fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: setting, error: settingErr } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'serviceability_check_enabled')
        .maybeSingle();
      if (settingErr) { console.error('[ServiceArea] gate load failed', settingErr); return; }
      if (!cancelled) setGateEnabled(String(setting?.setting_value ?? 'true').toLowerCase() === 'true');
    })();
    return () => { cancelled = true; };
  }, []);

  // "N active" describes the whole table, not the loaded page.
  const [activeCount, setActiveCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count, error: countErr } = await supabase
        .from('serviceable_pincodes')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (countErr) { console.error('[ServiceArea] active count failed', countErr); return; }
      if (!cancelled) setActiveCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [pincodes]);

  // ─── Requested areas ────────────────────────────────────────────────────
  // Demand logged by people whose pincode we don't cover. Read from the grouped
  // view so one row = one pincode rather than one row per person.
  const {
    rows: requests,
    totalCount: requestsTotal,
    loadingMore: requestsLoadingMore,
    loadMore: loadMoreRequests,
    refresh: refreshRequests,
  } = usePaginatedQuery({
    table: 'service_area_request_summary',
    select: '*',
    // Most-wanted first. `tiebreak` must be overridden: the default is `id`,
    // and a grouped view has no id column — the query would just error.
    orderBy: [{ column: 'request_count', ascending: false }],
    tiebreak: 'pincode',
    getRowId: (r) => r?.pincode,
  });

  const [busyPincode, setBusyPincode] = useState(null);
  const [contacts, setContacts] = useState({});

  const promoteRequest = async (row) => {
    setBusyPincode(row.pincode);
    try {
      const { error: err } = await supabase.from('serviceable_pincodes')
        .upsert({ pincode: row.pincode, is_active: true }, { onConflict: 'pincode' });
      if (err) throw err;
      await supabase.from('service_area_requests')
        .update({ status: 'serviced' }).eq('pincode', row.pincode).eq('status', 'pending');
      await Promise.all([fetchData(), refreshRequests()]);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusyPincode(null);
    }
  };

  const ignoreRequest = async (row) => {
    setBusyPincode(row.pincode);
    try {
      await supabase.from('service_area_requests')
        .update({ status: 'ignored' }).eq('pincode', row.pincode).eq('status', 'pending');
      await refreshRequests();
    } finally {
      setBusyPincode(null);
    }
  };

  // Phone numbers are the point of collecting them, so they have to be
  // reachable from here — the grouped view only carries a count.
  const toggleContacts = async (pincode) => {
    if (contacts[pincode]) { setContacts(p => ({ ...p, [pincode]: null })); return; }
    const { data } = await supabase
      .from('service_area_requests')
      .select('phone_number, created_at')
      .eq('pincode', pincode)
      .not('phone_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    setContacts(p => ({ ...p, [pincode]: data ?? [] }));
  };

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
        <div className="page-sub">{totalCount.toLocaleString('en-IN')} pincodes · {activeCount} active</div>
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
      <div className="search-filter">
        <RowsPerLoad />
      </div>
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
        <LoadMore
          shown={pincodes.length}
          total={totalCount}
          onLoadMore={loadMore}
          loading={loadingMore}
          label="pincodes"
        />
      </div>

      {/* Requested areas */}
      <div className="page-header" style={{ marginTop: 28 }}>
        <div className="page-title" style={{ fontSize: 18 }}>Requested Areas</div>
        <div className="page-sub">
          {requestsTotal.toLocaleString('en-IN')} pincodes people asked for but we don&apos;t deliver to
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pincode</th>
                <th>Requests</th>
                <th>People</th>
                <th>Contacts</th>
                <th>Last asked</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                  No requests yet. They appear here when someone enters a pincode you don&apos;t cover.
                </td></tr>
              ) : requests.map(row => (
                <React.Fragment key={row.pincode}>
                  <tr>
                    <td style={{ fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{row.pincode}</td>
                    <td>{Number(row.request_count).toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {Number(row.device_count).toLocaleString('en-IN')}
                      {Number(row.from_logged_in) > 0 && ` · ${row.from_logged_in} signed in`}
                    </td>
                    <td>
                      {Number(row.with_phone) > 0 ? (
                        <Button size="sm" onClick={() => toggleContacts(row.pincode)}>
                          {contacts[row.pincode] ? 'Hide' : `${row.with_phone} number${Number(row.with_phone) === 1 ? '' : 's'}`}
                        </Button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {row.last_requested_at
                        ? new Date(row.last_requested_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td><StatusBadge status={row.has_pending ? 'pending' : 'completed'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" variant="primary"
                          disabled={busyPincode === row.pincode}
                          onClick={() => promoteRequest(row)}>
                          {busyPincode === row.pincode ? 'Adding...' : 'Start delivering'}
                        </Button>
                        {row.has_pending && (
                          <Button size="sm" disabled={busyPincode === row.pincode}
                            onClick={() => ignoreRequest(row)}>Ignore</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {contacts[row.pincode] && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--bg-2)', padding: '10px 16px' }}>
                        {contacts[row.pincode].length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>No numbers left.</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {contacts[row.pincode].map((c, i) => (
                              <span key={`${c.phone_number}-${i}`}
                                style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5,
                                         background: 'var(--bg-1)', border: '1px solid var(--border)',
                                         borderRadius: 6, padding: '3px 8px' }}>
                                {c.phone_number}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore
          shown={requests.length}
          total={requestsTotal}
          onLoadMore={loadMoreRequests}
          loading={requestsLoadingMore}
          label="requested areas"
        />
      </div>
    </div>
  );
}
