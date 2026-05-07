// ============================================
// FILE: hooks/useOrders.js
// Added mounted guard to prevent stale setState.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 20;

export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'all',
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('orders')
        .select(`
          *,
          users!inner(full_name),
          products!inner(name, volume),
          addresses!left(city),
          subscriptions!left(frequency),
          route_stops!left(name)
        `, { count: 'exact' });

      if (filters.date) query = query.eq('delivery_date', filters.date);
      if (filters.status !== 'all') query = query.eq('status', filters.status);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: fetchError, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (!mountedRef.current) return;

      const transformedData = data?.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        subscriptionId: order.subscription_id,
        customerId: order.user_id,
        customerName: order.users?.full_name || 'Unknown',
        city: order.addresses?.city || '—',
        productName: order.products?.name || 'Unknown',
        productUnit: order.products?.volume || '',
        quantity: order.quantity || 1,
        amount: order.amount || 0,
        status: order.status || 'scheduled',
        date: order.delivery_date,
        failReason: order.failure_reason,
        riderId: order.rider_id,
        routeStopId: order.route_stop_id,
        stopName: order.route_stops?.name || '—',
        deliveredAt: order.delivered_at,
        deliveryNotes: order.delivery_notes,
        discountAmount: order.discount_amount || 0,
      })) || [];

      setOrders(transformedData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching orders:', err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrderStatus = useCallback(async (id, newStatus, additionalData = {}) => {
    try {
      const updateData = { status: newStatus, ...additionalData };
      if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
      const { error } = await supabase.from('orders').update(updateData).eq('id', id);
      if (error) throw error;
      await fetchOrders();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchOrders]);

  const updateOrderNotes = useCallback(async (id, notes) => {
    try {
      const { error } = await supabase.from('orders').update({ delivery_notes: notes }).eq('id', id);
      if (error) throw error;
      await fetchOrders();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchOrders]);

  const reassignDriver = useCallback(async (id, riderId) => {
    try {
      const { error } = await supabase.from('orders').update({ rider_id: riderId }).eq('id', id);
      if (error) throw error;
      await fetchOrders();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchOrders]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const goToPage = useCallback((newPage) => { setPage(newPage); }, []);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    orders, loading, error, page, totalPages, totalCount,
    filters, updateFilters, goToPage,
    updateOrderStatus, updateOrderNotes, reassignDriver,
    refresh: fetchOrders,
  };
}
