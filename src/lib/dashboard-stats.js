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

// PostgREST silently truncates responses at its max-rows ceiling (default
// 1000), so any full fetch must page until a short page proves completeness.
const PAGE = 1000;
async function fetchAllPages(makeQuery, label) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = unwrap(label)(await makeQuery().range(from, from + PAGE - 1));
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const headCount = (label) => (res) => unwrap(label)(res).count || 0;

export async function fetchDashboardStats(client) {
  const today = istToday();
  const weekDates = Array.from({ length: 7 }, (_, i) => istDate(i - 6));

  const [
    totalCustomers,
    activeSubscriptions,
    pausedCustomers,
    lowBalanceCount,
    atRiskCustomers,
    todayOrders,
    weekData,
  ] = await withTimeout(Promise.all([
    client.from('users').select('*', { count: 'exact', head: true })
      .then(headCount('users count')),
    client.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active')
      .then(headCount('active subscriptions count')),
    client.from('subscriptions').select('user_id', { count: 'exact', head: true }).eq('status', 'paused')
      .then(headCount('paused subscriptions count')),
    client.from('wallets').select('*', { count: 'exact', head: true })
      .lt('balance', 0)
      .then(headCount('negative-balance count')),
    client.from('wallets').select('*', { count: 'exact', head: true })
      .gte('balance', 0).lt('balance', 200)
      .then(headCount('at-risk count')),
    fetchAllPages(
      () => client.from('orders').select('status, amount, addresses(city)').eq('delivery_date', today),
      "today's orders",
    ),
    Promise.all(weekDates.map(d =>
      client.from('orders').select('*', { count: 'exact', head: true })
        .eq('status', 'delivered').eq('delivery_date', d)
        .then(headCount(`deliveries on ${d}`)),
    )),
  ]));

  const todayDelivered = todayOrders.filter(o => o.status === 'delivered').length;
  const todayFailed = todayOrders.filter(o => o.status === 'failed').length;
  const todayPending = todayOrders.filter(o => ['pending', 'in_transit', 'scheduled'].includes(o.status)).length;
  const todayRevenue = todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.amount || 0), 0);
  const todayOrderValue = todayOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const deliveryPct = todayOrders.length ? Math.round((todayDelivered / todayOrders.length) * 100) : 0;

  const zoneMap = {};
  todayOrders.forEach(order => {
    const zone = order.addresses?.city || 'Unknown';
    if (!zoneMap[zone]) zoneMap[zone] = { total: 0, done: 0 };
    zoneMap[zone].total += 1;
    if (order.status === 'delivered') zoneMap[zone].done += 1;
  });
  const zoneStats = Object.entries(zoneMap).map(([zone, s]) => ({ zone, total: s.total, done: s.done }));

  return {
    totalCustomers,
    activeSubscriptions,
    todayOrders: todayOrders.length,
    todayDelivered, todayFailed, todayPending, todayRevenue, todayOrderValue,
    atRiskCustomers, pausedCustomers,
    lowBalanceCount, deliveryPct, zoneStats, weekData,
  };
}
