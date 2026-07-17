// ============================================
// FILE: components/pages/BottleReturnsPage.jsx
// Admin view for bottle_returns table.
// Shows all bottle return requests with status,
// quantity, rider, customer, and photo.
// Allows admin to manually mark pending returns as collected.
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LoadMore } from '../ui/LoadMore';
import { RowsPerLoad } from '../ui/RowsPerLoad';
import { Select } from '../ui/Select';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDrivers } from '../../hooks/useDrivers';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { UserNameLink } from '../ui/UserNameLink';
import { Modal } from '../ui/Modal';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'requested', label: 'Requested' },
  { value: 'collected', label: 'Collected' },
  { value: 'cancelled', label: 'Cancelled' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const SELECT = `
  id,
  user_id,
  order_id,
  status,
  quantity,
  return_date,
  collected_at,
  notes,
  photo_url,
  created_at,
  users:user_id ( full_name, phone_number ),
  riders:rider_id ( users ( full_name ) ),
  addresses:address_id ( address_line1, city ),
  routes:route_id ( name ),
  route_stops:route_stop_id ( name ),
  orders:order_id ( order_number, bottle_photo_url )
`;

export function BottleReturnsPage() {
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markMsg, setMarkMsg] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);

  const { drivers } = useDrivers();
  const [reassignModal, setReassignModal] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [autoAssigning, setAutoAssigning] = useState(false);

  // One row per delivery that collected bottles, so this grows every morning.
  // It used to be fetched whole, which quietly stops being the whole thing once
  // it crosses PostgREST's max-rows ceiling.
  const {
    rows: returns,
    loading,
    error,
    totalCount,
    loadingMore,
    loadMore,
    filters,
    updateFilters,
    refresh: fetchReturns,
  } = usePaginatedQuery({
    table: 'bottle_returns',
    select: SELECT,
    initialFilters: { status: 'all', date: '' },
    applyFilters: (query, f) => {
      if (f.status !== 'all') query = query.eq('status', f.status);
      if (f.date) query = query.eq('return_date', f.date);
      return query;
    },
    orderBy: { column: 'created_at', ascending: false },
  });

  const statusFilter = filters.status;
  const dateFilter = filters.date;

  // The summary cards describe the whole filtered set, not the page, so they
  // come from the database rather than from counting the loaded rows.
  const [stats, setStats] = useState({
    total_records: 0, pending_count: 0, collected_count: 0, total_bottles: 0,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: statsErr } = await supabase.rpc('rpc_admin_bottle_return_stats', {
        p_status: statusFilter,
        p_date: dateFilter || null,
      });
      if (statsErr) { console.error('[BottleReturns] stats failed', statsErr); return; }
      if (!cancelled && data) setStats(data);
    })();
    return () => { cancelled = true; };
  }, [statusFilter, dateFilter, returns]);

  useDataRefresh(fetchReturns, 60000, true);

  const handleMarkCollected = async (returnId) => {
    setMarkingId(returnId);
    setMarkMsg(null);
    try {
      const { error } = await supabase
        .from('bottle_returns')
        .update({
          status: 'collected',
          collected_at: new Date().toISOString(),
        })
        .eq('id', returnId);
      if (error) throw error;
      setMarkMsg({ ok: true, text: 'Marked as collected ✓' });
      await fetchReturns(true);
      // Update selected return if open
      setSelectedReturn(prev => prev?.id === returnId ? { ...prev, status: 'collected', collected_at: new Date().toISOString() } : prev);
    } catch (err) {
      setMarkMsg({ ok: false, text: err.message });
    } finally {
      setMarkingId(null);
    }
  };

  const handleAutoAssign = async () => {
    if (!window.confirm("Run auto-assignment for today? This will assign pending bottle returns based on today's route assignments.")) return;
    setAutoAssigning(true);
    try {
      const { data, error } = await supabase.rpc('assign_riders_to_bottle_returns');
      if (error) throw error;
      alert(`Auto-assignment complete. Updated ${data?.updated || 0} bottle returns.`);
      fetchReturns(true);
    } catch (err) {
      alert(`Failed to run auto-assignment: ${err.message}`);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedDriver) return;
    try {
      const { error } = await supabase
        .from('bottle_returns')
        .update({ rider_id: selectedDriver })
        .eq('id', reassignModal.id);
      if (error) throw error;
      setReassignModal(null);
      setSelectedDriver('');
      fetchReturns(true);
      // Update selected return if open
      setSelectedReturn(prev => prev?.id === reassignModal.id ? { ...prev, rider_id: selectedDriver, riders: { users: { full_name: drivers.find(d => d.id === selectedDriver)?.full_name } } } : prev);
    } catch (err) {
      alert(`Reassign failed: ${err.message}`);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'pending': return 'var(--yellow)';
      case 'requested': return '#3b82f6';
      case 'collected': return 'var(--green)';
      case 'cancelled': return 'var(--text-4)';
      default: return 'var(--text-3)';
    }
  };

  if (loading && returns.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Bottle Returns</div>
          <div className="page-sub">
            {Number(stats.total_records).toLocaleString('en-IN')} records ·{' '}
            {stats.pending_count} pending · {stats.total_bottles} total bottles
          </div>
        </div>
        <div>
          <Button variant="outline" onClick={handleAutoAssign} disabled={autoAssigning}>
            {autoAssigning ? 'Running...' : 'Run Auto-Assignment'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Records', val: stats.total_records, color: 'var(--text)' },
          { label: 'Pending / Requested', val: stats.pending_count, color: 'var(--yellow)' },
          { label: 'Collected', val: stats.collected_count, color: 'var(--green)' },
          { label: 'Total Bottles', val: stats.total_bottles, color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="search-filter">
        <input
          type="date"
          className="form-input"
          style={{ width: 160 }}
          value={dateFilter}
          onChange={e => updateFilters({ date: e.target.value })}
          placeholder="Filter by date"
        />
        <Select
          value={statusFilter}
          onChange={value => updateFilters({ status: value })}
          options={STATUS_FILTERS}
        />
        {(statusFilter !== 'all' || dateFilter) && (
          <Button size="sm" onClick={() => updateFilters({ status: 'all', date: '' })}>
            Clear Filters
          </Button>
        )}
        <RowsPerLoad />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Address</th>
                <th>Route / Stop</th>
                <th>Rider</th>
                <th>Qty 🍶</th>
                <th>Type</th>
                <th>Linked Order</th>
                <th>Return Date</th>
                <th>Status</th>
                <th>Collected At</th>
                <th>Photo</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                    No bottle returns found
                  </td>
                </tr>
              ) : returns.map(r => (
                <tr key={r.id}>
                  <td>
                    <UserNameLink userId={r.user_id} name={r.users?.full_name} phone={r.users?.phone_number} />
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {r.addresses?.address_line1 || '—'}
                    {r.addresses?.city && <span>, {r.addresses.city}</span>}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {r.routes?.name || '—'}
                    {r.route_stops?.name && <div style={{ color: 'var(--text-4)', fontSize: 10.5 }}>📍 {r.route_stops.name}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {r.riders?.users?.full_name || '—'}
                  </td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                    🍶 {r.quantity}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: r.order_id ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                      color: r.order_id ? '#3b82f6' : '#ca8a04',
                    }}>
                      {r.order_id ? '⚡ Auto' : '📋 Manual'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11.5, fontFamily: "'DM Mono',monospace" }}>
                    {r.orders?.order_number ? (
                      <span style={{ color: 'var(--primary, #3b82f6)', cursor: 'default' }} title="Linked delivery order">
                        {r.orders.order_number}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-4)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {fmtDate(r.return_date)}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background: statusColor(r.status) + '20',
                      color: statusColor(r.status),
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {r.collected_at ? `${fmtDate(r.collected_at)} ${fmtTime(r.collected_at)}` : '—'}
                  </td>
                  <td>
                    {r.photo_url || r.orders?.bottle_photo_url ? (
                      <div
                        onClick={() => setPhotoModal(r.photo_url || r.orders?.bottle_photo_url)}
                        style={{ cursor: 'zoom-in', width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}
                      >
                        <img src={r.photo_url || r.orders?.bottle_photo_url} alt="Return" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button size="sm" onClick={() => { setSelectedReturn(r); setMarkMsg(null); }}>
                        View
                      </Button>
                      {(r.status === 'pending' || r.status === 'requested') && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleMarkCollected(r.id)}
                          disabled={markingId === r.id}
                        >
                          {markingId === r.id ? '...' : 'Collected'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore
          shown={returns.length}
          total={totalCount}
          onLoadMore={loadMore}
          loading={loadingMore}
          label="returns"
        />
      </div>

      {/* DETAIL DRAWER */}
      {selectedReturn && (
        <Drawer
          title={`Return — ${selectedReturn.users?.full_name || 'Unknown'}`}
          onClose={() => setSelectedReturn(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Customer', val: selectedReturn.users?.full_name || '—' },
              { label: 'Phone', val: selectedReturn.users?.phone_number || '—' },
              { label: 'Quantity', val: `🍶 ${selectedReturn.quantity}` },
              { label: 'Return Date', val: fmtDate(selectedReturn.return_date) },
              { label: 'Route', val: selectedReturn.routes?.name || '—' },
              { label: 'Stop', val: selectedReturn.route_stops?.name || '—' },
            ].map(row => (
              <div key={row.label} style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 7 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{row.val}</div>
              </div>
            ))}
            <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 7, gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>Assigned Rider</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedReturn.riders?.users?.full_name || 'Unassigned'}</div>
              </div>
              <Button size="sm" onClick={() => { setReassignModal(selectedReturn); setSelectedDriver(selectedReturn.rider_id || ''); }}>
                Change
              </Button>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="form-label">Status</div>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
              textTransform: 'uppercase',
              background: statusColor(selectedReturn.status) + '20',
              color: statusColor(selectedReturn.status),
              marginTop: 4,
            }}>
              {selectedReturn.status}
            </span>
          </div>

          {selectedReturn.collected_at && (
            <div style={{ padding: '10px 12px', background: 'var(--green-bg)', borderRadius: 7, marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, color: '#15803D' }}>
                ✓ Collected at {fmtDate(selectedReturn.collected_at)} {fmtTime(selectedReturn.collected_at)}
              </div>
            </div>
          )}

          {selectedReturn.notes && (
            <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 7, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>Notes</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{selectedReturn.notes}</div>
            </div>
          )}

          {(selectedReturn.photo_url || selectedReturn.orders?.bottle_photo_url) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Bottle Photo</div>
              <img
                src={selectedReturn.photo_url || selectedReturn.orders?.bottle_photo_url}
                alt="Bottle return proof"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}

          {markMsg && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12,
              background: markMsg.ok ? 'rgba(34,197,94,0.1)' : 'var(--red-bg)',
              color: markMsg.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {markMsg.text}
            </div>
          )}

          {(selectedReturn.status === 'pending' || selectedReturn.status === 'requested') && (
            <Button
              variant="primary"
              style={{ width: '100%' }}
              onClick={() => handleMarkCollected(selectedReturn.id)}
              disabled={markingId === selectedReturn.id}
            >
              {markingId === selectedReturn.id ? 'Marking...' : 'Mark as Collected'}
            </Button>
          )}
        </Drawer>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {photoModal && (
        <div
          onClick={() => setPhotoModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 24,
          }}
        >
          <img
            src={photoModal}
            alt="Full size"
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setPhotoModal(null)}
            style={{
              position: 'absolute', top: 16, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}

      {/* REASSIGN MODAL */}
      {reassignModal && (
        <Modal title="Change Assigned Driver" onClose={() => setReassignModal(null)}>
          <div className="form-group">
            <label className="form-label">Select Driver</label>
            <Select
              value={selectedDriver}
              onChange={setSelectedDriver}
              options={[
                { value: '', label: '-- Select Driver --' },
                ...drivers.map(d => ({ value: d.id, label: d.full_name }))
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="outline" onClick={() => setReassignModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleReassign} disabled={!selectedDriver}>Reassign</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
