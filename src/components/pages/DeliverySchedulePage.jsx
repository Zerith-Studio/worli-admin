// ============================================
// FILE: components/pages/DeliverySchedulePage.jsx
// Removed: Lock Schedule button.
// Real orders per route for tomorrow from DB.
//
// WHAT THIS PAGE LISTS, AND WHY IT PAGINATES HUBS RATHER THAN ORDERS
// ------------------------------------------------------------------
// The cards are one-per-zone with an order COUNT on each — an aggregate over
// every scheduled order for tomorrow, not a list of orders. The old code got
// those counts by fetching every scheduled order for tomorrow and tallying them
// in JS, which is unbounded and silently wrong the moment tomorrow's order book
// crosses PostgREST's max-rows ceiling: the tally then describes the first N
// orders and says nothing about it.
//
// Paginating the ORDERS would not fix that — it would make it worse, because
// grouping one page of 20 orders yields per-zone counts that describe only that
// page while still looking like whole-day totals. So the list being paginated is
// the ZONE list (hubs), and each card's count is a `head: true` exact count
// scoped to that hub. The counts are now whole-day figures regardless of which
// page you are on.
// ============================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../hooks/useSettings';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LoadMore } from '../ui/LoadMore';
import { RowsPerLoad } from '../ui/RowsPerLoad';

/** Tomorrow as an ISO date string — the day this page is about. */
function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Tomorrow's scheduled-order count, for one hub or for the unassigned bucket. */
async function countScheduled(buildFilter) {
  let q = supabase
    .from('orders')
    .select('id, routes!inner(hub_id)', { count: 'exact', head: true })
    .eq('delivery_date', tomorrowISO())
    .eq('status', 'scheduled');
  q = buildFilter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export function DeliverySchedulePage() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const { getSetting, loading: settingsLoading } = useSettings();

  const cutoffTimeSetting = getSetting('order_modification_cutoff_time', '19:00');

  // One card per hub. The per-hub count is a head-only count query, so it runs
  // for the ~20 hubs on the page and returns a number rather than rows.
  const {
    rows: scheduleData,
    loading: scheduleLoading,
    error: scheduleError,
    totalCount, loadingMore, loadMore,
  } = usePaginatedQuery({
    table: 'hubs',
    select: 'id, name',
    orderBy: { column: 'name', ascending: true },
    transform: async (hubs) =>
      Promise.all(
        hubs.map(async (h) => ({
          zone: h.name,
          orders: await countScheduled((q) => q.eq('routes.hub_id', h.id)),
        }))
      ),
  });

  // Orders with no route, or on a route with no hub, belong to no hub row and so
  // cannot come from the paginated query above. The old code lumped both into an
  // "Unassigned Zone" card; this keeps that card and counts it server-side.
  const [unassigned, setUnassigned] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [noRoute, noHub] = await Promise.all([
          // No route at all: needs a plain count, since `routes!inner` would
          // drop exactly the rows being counted.
          (async () => {
            const { count, error } = await supabase
              .from('orders')
              .select('id', { count: 'exact', head: true })
              .eq('delivery_date', tomorrowISO())
              .eq('status', 'scheduled')
              .is('route_id', null);
            if (error) throw error;
            return count ?? 0;
          })(),
          countScheduled((q) => q.is('routes.hub_id', null)),
        ]);
        if (!cancelled) setUnassigned(noRoute + noHub);
      } catch (err) {
        console.error('Error counting unassigned orders:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Countdown timer to cutoff
  useEffect(() => {
    if (settingsLoading) return;

    const update = () => {
      const now = new Date();
      const [hours, minutes] = cutoffTimeSetting.split(':').map(Number);
      const cutoffDate = new Date(now);
      cutoffDate.setHours(hours, minutes, 0, 0);
      let diffSeconds = Math.floor((cutoffDate - now) / 1000);
      if (diffSeconds <= 0) { setTimeLeft('00:00:00'); return; }
      const h = Math.floor(diffSeconds / 3600);
      const m = Math.floor((diffSeconds % 3600) / 60);
      const s = diffSeconds % 60;
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cutoffTimeSetting, settingsLoading]);

  const formatAMPM = timeStr => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Delivery Schedule — Tomorrow</div>
        <div className="page-sub">{tomorrowLabel}</div>
      </div>

      <div className="cutoff-timer">
        <span style={{ fontSize: 13 }}>⏰</span>
        <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 500 }}>Order cutoff in</span>
        <span className="cutoff-time">{timeLeft}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>— no changes after {formatAMPM(cutoffTimeSetting)}</span>
      </div>

      <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)', border: '1px solid var(--border)' }}>
        ⚙️ Orders are auto-generated by the daily cron job at midnight. This view shows what has already been scheduled for tomorrow.
      </div>

      {scheduleError && (
        <div className="card" style={{ marginBottom: 12, color: 'var(--red)' }}>
          Error loading schedule: {scheduleError}
        </div>
      )}

      {scheduleLoading && scheduleData.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
      ) : scheduleData.length === 0 && unassigned === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
          No orders scheduled for tomorrow yet.
        </div>
      ) : (
        <>
          <div className="search-filter">
            <RowsPerLoad />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {/* Not a hub, so it isn't part of the appending list — it sits at
                the top alongside the zones, where the old grouping put it. */}
            {unassigned > 0 && (
              <div className="card">
                <div className="card-title">
                  📍 Unassigned Zone
                  <span style={{ fontFamily: "'DM Mono',monospace" }}>{unassigned} orders</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={() => navigate('/orders')}>View Orders</Button>
                </div>
              </div>
            )}
            {scheduleData.map((z, idx) => (
              <div key={idx} className="card">
                <div className="card-title">
                  📍 {z.zone}
                  <span style={{ fontFamily: "'DM Mono',monospace" }}>{z.orders} orders</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={() => navigate('/orders')}>View Orders</Button>
                </div>
              </div>
            ))}
          </div>
          <LoadMore
            shown={scheduleData.length}
            total={totalCount}
            onLoadMore={loadMore}
            loading={loadingMore}
            label="zones"
          />
        </>
      )}
    </div>
  );
}
