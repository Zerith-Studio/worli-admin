// ============================================
// FILE: hooks/useDashboardStats.js
// Hook for fetching dashboard statistics
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const TODAY = new Date().toISOString().split('T')[0];

export function useDashboardStats() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeSubscriptions: 0,
    todayOrders: 0,
    todayDelivered: 0,
    todayFailed: 0,
    todayPending: 0,
    todayRevenue: 0,
    atRiskCustomers: 0,
    pausedCustomers: 0,
    lowBalanceCount: 0,
    deliveryPct: 0,
    zoneStats: [],
    loading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      // Fetch total customers
      const { count: totalCustomers, error: customersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (customersError) throw customersError;

      // Fetch active subscriptions
      const { count: activeSubscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (subsError) throw subsError;

      // Fetch today's orders
      const { data: todayOrdersData, error: ordersError } = await supabase
        .from('orders')
        .select('status, amount')
        .eq('delivery_date', TODAY);

      if (ordersError) throw ordersError;

      const todayOrders = todayOrdersData || [];
      const todayDelivered = todayOrders.filter(o => o.status === 'delivered').length;
      const todayFailed = todayOrders.filter(o => o.status === 'failed').length;
      const todayPending = todayOrders.filter(o => ['pending', 'in_transit', 'scheduled'].includes(o.status)).length;
      const todayRevenue = todayOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.amount || 0), 0);

      const deliveryPct = todayOrders.length ? Math.round((todayDelivered / todayOrders.length) * 100) : 0;

      // Fetch customers with low/negative balance
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance');

      if (walletError) throw walletError;

      const lowBalanceCount = walletData?.filter(w => (w.balance || 0) < 0).length || 0;
      const atRiskCustomers = walletData?.filter(w => (w.balance || 0) >= 0 && (w.balance || 0) < 200).length || 0;

      // Fetch paused customers
      const { count: pausedCustomers, error: pausedError } = await supabase
        .from('subscriptions')
        .select('user_id', { count: 'exact', head: true })
        .eq('status', 'paused');

      if (pausedError) throw pausedError;

      // Fetch zone stats (requires addresses with zones)
      const { data: addressesData, error: addrError } = await supabase
        .from('addresses')
        .select('city');

      if (addrError) throw addrError;

      // Group by city/zone
      const zoneMap = {};
      addressesData?.forEach(addr => {
        const zone = addr.city || 'Unknown';
        zoneMap[zone] = (zoneMap[zone] || 0) + 1;
      });

      const zoneStats = Object.entries(zoneMap).map(([zone, count]) => ({
        zone,
        total: count,
        done: Math.round(count * 0.7), // Mock for now
      }));

      setStats({
        totalCustomers: totalCustomers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        todayOrders: todayOrders.length,
        todayDelivered,
        todayFailed,
        todayPending,
        todayRevenue,
        atRiskCustomers,
        pausedCustomers: pausedCustomers || 0,
        lowBalanceCount,
        deliveryPct,
        zoneStats,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refresh: fetchStats };
}
