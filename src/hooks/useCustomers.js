// ============================================
// FILE: hooks/useCustomers.js
// Hook for fetching and managing customers
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 12;

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    zone: 'all',
    status: 'all',
  });

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('users')
        .select(`
          *,
          wallets(balance),
          addresses(city, is_default),
          subscriptions!left(id, status)
        `, { count: 'exact' });

      // Apply search filter
      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`);
      }

      // Apply pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error: fetchError, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to match the expected format
      const transformedData = data?.map(user => {
        const wallet = user.wallets?.[0];
        const defaultAddress = user.addresses?.find(a => a.is_default) || user.addresses?.[0];
        const activeSubs = user.subscriptions?.filter(s => s.status === 'active') || [];
        
        // Calculate status based on wallet
        let status = 'active';
        if (wallet?.balance < 0) status = 'paused';
        else if (wallet?.balance < 200) status = 'at_risk';

        return {
          id: user.id,
          name: user.full_name || 'Unnamed',
          phone: user.phone_number,
          email: user.email,
          zone: defaultAddress?.city || 'Unknown',
          wallet: wallet?.balance || 0,
          bottles_pending: user.bottles_pending || 0,
          status,
          joined: user.created_at?.split('T')[0],
          totalOrders: user.subscriptions?.length || 0,
          activeSubscriptions: activeSubs.length,
          totalRevenue: 0, // Calculate from orders
        };
      }) || [];

      // Apply status filter (client-side since it's computed)
      let filteredData = transformedData;
      if (filters.status !== 'all') {
        filteredData = transformedData.filter(c => c.status === filters.status);
      }

      // Apply zone filter
      if (filters.zone !== 'all') {
        filteredData = filteredData.filter(c => c.zone === filters.zone);
      }

      setCustomers(filteredData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page on filter change
  }, []);

  const goToPage = useCallback((newPage) => {
    setPage(newPage);
  }, []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    customers,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    filters,
    updateFilters,
    goToPage,
    refresh: fetchCustomers,
  };
}
