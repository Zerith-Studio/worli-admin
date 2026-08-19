// ============================================
// FILE: lib/dashboard-stats.js
// ============================================

import { withTimeout } from './query';
import { istToday, istDate } from '../utils/formatters';

// supabase-js resolves failures as { error } rather than throwing; an
// unchecked response turns an RLS denial or renamed column into confident
// zeros on the dashboard.
const unwrap = (label) => (res) => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res;
};

export async function fetchDashboardStats(client) {
  const today = istToday();
  const weekDates = Array.from({ length: 7 }, (_, i) => istDate(i - 6));

  const [
    { count: totalCustomers },
    { count: activeSubscriptions },
    { data: todayOrdersData },
    { data: walletData },
    { count: pausedCustomers },
    { data: zoneOrdersData },
    { data: weekOrders },
  ] = await withTimeout(Promise.all([
    client.from('users').select('*', { count: 'exact', head: true })
      .then(unwrap('users count')),
    client.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active')
      .then(unwrap('active subscriptions count')),
    client.from('orders').select('status, amount').eq('delivery_date', today)
      .then(unwrap("today's orders")),
    client.from('wallets').select('balance')
      .then(unwrap('wallet balances')),
    client.from('subscriptions').select('user_id', { count: 'exact', head: true }).eq('status', 'paused')
      .then(unwrap('paused subscriptions count')),
    client.from('orders').select('status, addresses!inner(city)').eq('delivery_date', today)
      .then(unwrap('zone orders')),
    client.from('orders').select('delivery_date').eq('status', 'delivered')
      .gte('delivery_date', weekDates[0]).lte('delivery_date', weekDates[6])
      .then(unwrap('week orders')),
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

  return {
    totalCustomers: totalCustomers || 0,
    activeSubscriptions: activeSubscriptions || 0,
    todayOrders: todayOrders.length,
    todayDelivered, todayFailed, todayPending, todayRevenue, todayOrderValue,
    atRiskCustomers, pausedCustomers: pausedCustomers || 0,
    lowBalanceCount, deliveryPct, zoneStats, weekData,
  };
}
