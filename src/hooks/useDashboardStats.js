// ============================================
// FILE: hooks/useDashboardStats.js
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/query';
import { useDataRefresh } from './useDataRefresh';

const initialStats = {
  totalCustomers: 0,
  activeSubscriptions: 0,
  todayOrders: 0,
  todayDelivered: 0,
  todayFailed: 0,
  todayPending: 0,
  todayRevenue: 0,
  todayOrderValue: 0,
  atRiskCustomers: 0,
  pausedCustomers: 0,
  lowBalanceCount: 0,
  deliveryPct: 0,
  zoneStats: [],
  weekData: [],
};

export function useDashboardStats() {
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      const [
        { count: totalCustomers },
        { count: activeSubscriptions },
        { data: todayOrdersData },
        { data: walletData },
        { count: pausedCustomers },
        { data: zoneOrdersData },
        { data: weekOrders },
      ] = await withTimeout(Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('orders').select('status, amount').eq('delivery_date', today),
        supabase.from('wallets').select('balance'),
        supabase.from('subscriptions').select('user_id', { count: 'exact', head: true }).eq('status', 'paused'),
        supabase.from('orders').select('status, addresses!inner(city)').eq('delivery_date', today),
        supabase.from('orders').select('delivery_date').eq('status', 'delivered')
          .gte('delivery_date', weekDates[0]).lte('delivery_date', weekDates[6]),
      ]));

      const todayOrders = todayOrdersData || [];
      const todayDelivered = todayOrders.filter(o => o.status === 'delivered').length;
      const todayFailed = todayOrders.filter(o => o.status === 'failed').length;
      const todayPending = todayOrders.filter(o => ['pending', 'in_transit', 'scheduled'].includes(o.status)).length;
      const todayRevenue = todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.amount || 0), 0);
      const todayOrderValue = todayOrders.reduce((s, o) => s + (o.amount || 0), 0);
      const deliveryPct = todayOrders.length ? Math.round((todayDelivered / todayOrders.length) * 100) : 0;

      const lowBalanceCount = (walletData || []).filter(w => (w.balance || 0) < 0).length;
      const atRiskCustomers = (walletData || []).filter(w => (w.balance || 0) >= 0 && (w.balance || 0) < 200).length;

      const zoneMap = {};
      (zoneOrdersData || []).forEach(order => {
        const zone = order.addresses?.city || 'Unknown';
        if (!zoneMap[zone]) zoneMap[zone] = { total: 0, done: 0 };
        zoneMap[zone].total += 1;
        if (order.status === 'delivered') zoneMap[zone].done += 1;
      });
      const zoneStats = Object.entries(zoneMap).map(([zone, s]) => ({ zone, total: s.total, done: s.done }));

      const weekMap = {};
      weekDates.forEach(d => (weekMap[d] = 0));
      (weekOrders || []).forEach(o => { if (weekMap[o.delivery_date] !== undefined) weekMap[o.delivery_date] += 1; });
      const weekData = weekDates.map(d => weekMap[d]);

      setStats({
        totalCustomers: totalCustomers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        todayOrders: todayOrders.length,
        todayDelivered, todayFailed, todayPending, todayRevenue, todayOrderValue,
        atRiskCustomers, pausedCustomers: pausedCustomers || 0,
        lowBalanceCount, deliveryPct, zoneStats, weekData,
      });
    } catch (err) {
      console.error('[useDashboardStats] error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useDataRefresh(fetch);

  return { ...stats, loading, error, refresh: fetch };
}
