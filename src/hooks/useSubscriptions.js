// ============================================
// FILE: hooks/useSubscriptions.js
// Hook for fetching and managing subscriptions
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 15;

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
  });

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('subscriptions')
        .select(`
          *,
          users!inner(full_name),
          products!inner(name, volume, price),
          addresses!left(city)
        `, { count: 'exact' });

      // Apply filters
      if (filters.type !== 'all') {
        query = query.eq('frequency', filters.type);
      }
      
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.ilike('users.full_name', `%${filters.search}%`);
      }

      // Apply pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error: fetchError, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data
      const transformedData = data?.map(sub => ({
        id: sub.id,
        customerId: sub.user_id,
        customerName: sub.users?.full_name || 'Unknown',
        zone: sub.addresses?.city || 'Unknown',
        productId: sub.product_id,
        productName: sub.products?.name || 'Unknown',
        productUnit: sub.products?.volume || '',
        quantity: sub.quantity || 1,
        type: sub.frequency || 'daily',
        status: sub.status || 'active',
        startDate: sub.start_date,
        price: (sub.products?.price || 0) * (sub.quantity || 1),
        override: null, // TODO: Implement override logic
        customDays: sub.custom_quantities ? Object.keys(sub.custom_quantities).map(Number) : null,
      })) || [];

      setSubscriptions(transformedData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const updateSubscriptionStatus = useCallback(async (id, newStatus, holdData = null) => {
    try {
      if (newStatus === 'paused' && holdData) {
        // Create a subscription hold
        const { error } = await supabase
          .from('subscription_holds')
          .insert({
            subscription_id: id,
            start_date: holdData.start_date,
            end_date: holdData.end_date,
            reason: holdData.reason || 'Admin hold',
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .update({ status: newStatus })
          .eq('id', id);

        if (error) throw error;
      }

      // Refresh data
      await fetchSubscriptions();
      return { success: true };
    } catch (err) {
      console.error('Error updating subscription:', err);
      return { success: false, error: err.message };
    }
  }, [fetchSubscriptions]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const goToPage = useCallback((newPage) => {
    setPage(newPage);
  }, []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    subscriptions,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    filters,
    updateFilters,
    goToPage,
    updateSubscriptionStatus,
    refresh: fetchSubscriptions,
  };
}
