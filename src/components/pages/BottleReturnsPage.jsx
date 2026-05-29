// ============================================
// FILE: components/pages/BottleReturnsPage.jsx
// Admin view for bottle_returns table.
// Shows all bottle return requests with status,
// quantity, rider, customer, and photo.
// Allows admin to manually mark pending returns as collected.
// ============================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Select } from '../ui/Select';
import { useDataRefresh } from '../../hooks/useDataRefresh';

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

export function BottleReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markMsg, setMarkMsg] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchReturns = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      let query = supabase
        .from('bottle_returns')
        .select(`
          id,
          status,
          quantity,
          return_date,
          collected_at,
          notes,
          photo_url,
          created_at,
          users:user_id ( full_name, phone_number ),
          riders:rider_id ( users:id ( full_name ) ),
          addresses:address_id ( address_line1, city ),
          routes:route_id ( name ),
          route_stops:route_stop_id ( name )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (dateFilter) query = query.eq('return_date', dateFilter);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      if (!mountedRef.current) return;

      setReturns(data || []);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);
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

  const statusColor = (status) => {
    switch (status) {
      case 'pending': return 'var(--yellow)';
      case 'requested': return '#3b82f6';
      case 'collected': return 'var(--green)';
      case 'cancelled': return 'var(--text-4)';
      default: return 'var(--text-3)';
    }
  };

  const pendingCount = returns.filter(r => r.status === 'pending' || r.status === 'requested').length;
  const totalBottles = returns.reduce((s, r) => s + (r.quantity || 0), 0);

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
          <div className="page-sub">{returns.length} records · {pendingCount} pending · {totalBottles} total bottles</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Records', val: returns.length, color: 'var(--text)' },
          { label: 'Pending / Requested', val: pendingCount, color: 'var(--yellow)' },
          { label: 'Collected', val: returns.filter(r => r.status === 'collected').length, color: 'var(--green)' },
          { label: 'Total Bottles', val: totalBottles, color: 'var(--text)' },
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
          onChange={e => setDateFilter(e.target.value)}
          placeholder="Filter by date"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS}
        />
        {(statusFilter !== 'all' || dateFilter) && (
          <Button size="sm" onClick={() => { setStatusFilter('all'); setDateFilter(''); }}>
            Clear Filters
          </Button>
        )}
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
                <th>Return Date</th>
                <th>Status</th>
                <th>Collected At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>
                    No bottle returns found
                  </td>
                </tr>
              ) : returns.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.users?.full_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{r.users?.phone_number}</div>
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

          {selectedReturn.photo_url && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Bottle Photo</div>
              <img
                src={selectedReturn.photo_url}
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
    </div>
  );
}
