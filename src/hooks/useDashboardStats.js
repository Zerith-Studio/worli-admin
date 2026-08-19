// ============================================
// FILE: hooks/useDashboardStats.js
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchDashboardStats } from '../lib/dashboard-stats';
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
      setStats(await fetchDashboardStats(supabase));
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
