// ============================================
// FILE: hooks/useAssets.js
// Hook for fetching asset/bottle tracking data
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 20;

export function useAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawReturns, setRawReturns] = useState([]);
  const [stats, setStats] = useState({
    totalIssued: 0,
    totalReturned: 0,
    totalPending: 0,
    highOverdue: 0,
  });

  const fetchAssets = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      // Fetch bottle returns
      const { data: returns, error: returnsError } = await supabase
        .from('bottle_returns')
        .select(`
          id, user_id, quantity, status, return_date, notes,
          addresses (address_line1, city, route_stop_id),
          routes (name),
          route_stops (name),
          users:user_id (full_name, phone_number)
        `);

      if (returnsError) throw returnsError;

      setRawReturns(returns || []);

      // Fetch users with bottles_pending
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          bottles_pending,
          addresses(city)
        `);

      if (usersError) throw usersError;

      // Calculate bottle stats per user
      const userReturns = {};
      returns?.forEach(ret => {
        if (!userReturns[ret.user_id]) {
          userReturns[ret.user_id] = { issued: 0, returned: 0 };
        }
        userReturns[ret.user_id].returned += (ret.quantity || 0);
      });

      // Calculate issued based on orders (simplified)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('user_id, quantity')
        .eq('status', 'delivered');

      if (ordersError) throw ordersError;

      orders?.forEach(order => {
        if (!userReturns[order.user_id]) {
          userReturns[order.user_id] = { issued: 0, returned: 0 };
        }
        userReturns[order.user_id].issued += (order.quantity || 1);
      });

      // Transform data
      const transformedData = users?.map(user => {
        const userRet = userReturns[user.id] || { issued: 0, returned: 0 };
        const pending = user.bottles_pending || Math.max(0, userRet.issued - userRet.returned);
        const returnRate = userRet.issued > 0 ? Math.round((userRet.returned / userRet.issued) * 100) : 100;
        
        let risk = 'low';
        if (pending > 3) risk = 'high';
        else if (pending > 1) risk = 'medium';

        return {
          id: user.id,
          name: user.full_name || 'Unknown',
          zone: user.addresses?.[0]?.city || 'Unknown',
          issued: userRet.issued,
          returned: userRet.returned,
          pending,
          returnRate,
          risk,
        };
      }) || [];

      // Calculate stats
      const totalIssued = transformedData.reduce((sum, a) => sum + a.issued, 0);
      const totalReturned = transformedData.reduce((sum, a) => sum + a.returned, 0);
      const totalPending = transformedData.reduce((sum, a) => sum + a.pending, 0);
      const highOverdue = transformedData.filter(a => a.pending > 3).length;

      setStats({
        totalIssued,
        totalReturned,
        totalPending,
        highOverdue,
      });

      setAssets(transformedData.slice(0, PAGE_SIZE));
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const assignBottleReturn = async (returnId, updates) => {
    try {
      const { error } = await supabase
        .from('bottle_returns')
        .update(updates)
        .eq('id', returnId);
      if (error) throw error;
      fetchAssets();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  return {
    assets,
    rawReturns,
    stats,
    loading,
    error,
    refresh: fetchAssets,
    assignBottleReturn,
  };
}
