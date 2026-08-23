// ============================================
// FILE: hooks/useDrivers.js
// Riders table no longer has hub_id.
// Hub is derived via rider_routes → routes → hubs.
// Route assignment uses hub→route cascade (select hub first, then its routes).
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/query';
import { istToday } from '../utils/formatters';

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);   // all active routes (with hub info)
  const [hubs, setHubs] = useState([]);       // all active hubs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchDrivers = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      // Fetch hubs and routes for cascade assignment dropdowns
      const [{ data: hubsData }, { data: routesData }] = await withTimeout(Promise.all([
        supabase.from('hubs').select('id, name').eq('is_active', true).order('name'),
        supabase.from('routes').select('id, name, hub_id, hubs(name)').eq('is_active', true).order('name'),
      ]));
      if (mountedRef.current) {
        setHubs(hubsData || []);
        setRoutes(routesData || []);
      }

      // Fetch riders (no hub_id any more)
      const { data: ridersData, error: ridersError } = await supabase
        .from('riders')
        .select('id, vehicle_info, status, is_verified, total_deliveries, rating');
      if (ridersError) throw ridersError;

      const riderIds = ridersData?.map(r => r.id) || [];
      if (riderIds.length === 0) {
        if (mountedRef.current) { setDrivers([]); setLoading(false); }
        return;
      }

      // Fetch user profiles (name, phone)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, phone_number')
        .in('id', riderIds);
      const usersMap = {};
      usersData?.forEach(u => { usersMap[u.id] = u; });

      // Fetch delivery stats from orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('rider_id, status')
        .in('rider_id', riderIds)
        .in('status', ['delivered', 'failed']);
      const statsMap = {};
      ordersData?.forEach(o => {
        if (!statsMap[o.rider_id]) statsMap[o.rider_id] = { completed: 0, failed: 0 };
        if (o.status === 'delivered') statsMap[o.rider_id].completed++;
        else if (o.status === 'failed') statsMap[o.rider_id].failed++;
      });

      // Fetch route assignments per rider: permanent (assigned_date IS NULL)
      // plus today's one-day overrides. Each is tagged so the UI can split them.
      const today = istToday();
      const { data: routeAssignments } = await supabase
        .from('rider_routes')
        .select('rider_id, route_id, assigned_date, routes(name, hub_id, hubs(name))')
        .in('rider_id', riderIds)
        .or(`assigned_date.is.null,assigned_date.eq.${today}`);
      const assignmentMap = {};
      routeAssignments?.forEach(ra => {
        if (!assignmentMap[ra.rider_id]) assignmentMap[ra.rider_id] = [];
        assignmentMap[ra.rider_id].push({
          routeId: ra.route_id,
          routeName: ra.routes?.name || '—',
          hubName: ra.routes?.hubs?.name || '—',
          isPermanent: ra.assigned_date === null,
          isOverride: ra.assigned_date !== null,
        });
      });

      if (!mountedRef.current) return;

      const transformed = ridersData.map(rider => ({
        id: rider.id,
        name: usersMap[rider.id]?.full_name || 'Unnamed',
        phone: usersMap[rider.id]?.phone_number || '—',
        vehicle: rider.vehicle_info || '—',
        status: rider.status || 'active',
        isVerified: rider.is_verified || false,
        totalDeliveries: rider.total_deliveries || 0,
        rating: rider.rating ? Number(rider.rating).toFixed(1) : '5.0',
        completedDeliveries: statsMap[rider.id]?.completed || 0,
        failedDeliveries: statsMap[rider.id]?.failed || 0,
        assignedRoutes: assignmentMap[rider.id] || [],
        // Derive primary hub from today's first route assignment
        hubName: assignmentMap[rider.id]?.[0]?.hubName || 'Unassigned',
      }));

      setDrivers(transformed);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const updateDriverStatus = useCallback(async (id, status) => {
    try {
      const { error } = await supabase.from('riders').update({ status }).eq('id', id);
      if (error) throw error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  const updateDriverVerified = useCallback(async (id, is_verified) => {
    try {
      const { error } = await supabase.from('riders').update({ is_verified }).eq('id', id);
      if (error) throw error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  // Profile editing: name/phone → users; vehicle → riders (no hub_id)
  const updateDriverProfile = useCallback(async (id, { full_name, phone_number, vehicle_info }) => {
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('users').update({ full_name, phone_number }).eq('id', id),
        supabase.from('riders').update({ vehicle_info }).eq('id', id),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  // Promote an existing user to a rider (insert into riders table).
  const createRider = useCallback(async (userId, vehicleInfo) => {
    try {
      const { error } = await supabase.from('riders').insert({
        id: userId,
        vehicle_info: vehicleInfo || null,
        status: 'active',
      });
      if (error) throw error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  // Search users (by name, phone, or id) who are not already riders.
  const searchPromotableUsers = useCallback(async (q) => {
    const term = (q || '').trim();
    if (term.length < 2) return [];
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
      let query = supabase.from('users').select('id, full_name, phone_number, email');
      if (isUuid) {
        query = query.eq('id', term);
      } else {
        query = query.or(`full_name.ilike.%${term}%,phone_number.ilike.%${term}%`);
      }
      const { data, error } = await query.limit(15);
      if (error) throw error;

      // Exclude users who are already riders.
      const ids = (data || []).map(u => u.id);
      if (ids.length === 0) return [];
      const { data: existing } = await supabase.from('riders').select('id').in('id', ids);
      const riderIds = new Set((existing || []).map(r => r.id));
      return (data || []).filter(u => !riderIds.has(u.id));
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  }, []);

  // Assign a route to a rider. Permanent by default; pass { permanent: false }
  // for a one-day override (which also re-stamps that day's orders immediately).
  const assignRoute = useCallback(async (riderId, routeId, opts = {}) => {
    const { permanent = true, date } = opts;
    try {
      if (permanent) {
        const { error } = await supabase.rpc('set_permanent_route', {
          p_route_id: routeId, p_rider_id: riderId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('set_route_override', {
          p_route_id: routeId,
          p_rider_id: riderId,
          p_date: date || istToday(),
        });
        if (error) throw error;
      }
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  // Remove a route from a rider. Permanent by default; pass { permanent: false }
  // to clear a one-day override (reverting that day to the permanent rider).
  const removeRoute = useCallback(async (riderId, routeId, opts = {}) => {
    const { permanent = true, date } = opts;
    try {
      if (permanent) {
        const { error } = await supabase.rpc('remove_permanent_route', { p_route_id: routeId });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('remove_route_override', {
          p_route_id: routeId,
          p_date: date || istToday(),
        });
        if (error) throw error;
      }
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  return {
    drivers, routes, hubs, loading, error,
    updateDriverStatus, updateDriverVerified, updateDriverProfile,
    assignRoute, removeRoute, createRider, searchPromotableUsers,
    refresh: fetchDrivers,
  };
}
