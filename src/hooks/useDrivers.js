// ============================================
// FILE: hooks/useDrivers.js
// Rewritten per schema.sql: riders table has hub_id, vehicle_info,
// status, is_verified, total_deliveries. Name/phone come from users.
// Added: profile editing, verified toggle, route assignment,
// completed/failed delivery counts from orders table.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [hubs, setHubs] = useState([]);
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

      // Fetch hubs and routes for assignment dropdowns
      const [{ data: hubsData }, { data: routesData }] = await Promise.all([
        supabase.from('hubs').select('id, name').eq('is_active', true).order('name'),
        supabase.from('routes').select('id, name, hub_id, hubs(name)').eq('is_active', true).order('name'),
      ]);
      if (mountedRef.current) {
        setHubs(hubsData || []);
        setRoutes(routesData || []);
      }

      // Fetch riders with hub info
      const { data: ridersData, error: ridersError } = await supabase
        .from('riders')
        .select('*, hubs(name)');
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

      // Fetch today's route assignments per rider
      const today = new Date().toISOString().split('T')[0];
      const { data: routeAssignments } = await supabase
        .from('rider_routes')
        .select('rider_id, route_id, routes(name)')
        .in('rider_id', riderIds)
        .eq('assigned_date', today);
      const assignmentMap = {};
      routeAssignments?.forEach(ra => {
        if (!assignmentMap[ra.rider_id]) assignmentMap[ra.rider_id] = [];
        assignmentMap[ra.rider_id].push({ routeId: ra.route_id, routeName: ra.routes?.name || '—' });
      });

      if (!mountedRef.current) return;

      const transformed = ridersData.map(rider => ({
        id: rider.id,
        name: usersMap[rider.id]?.full_name || 'Unnamed',
        phone: usersMap[rider.id]?.phone_number || '—',
        hubId: rider.hub_id,
        hubName: rider.hubs?.name || 'Unassigned',
        vehicle: rider.vehicle_info || '—',
        status: rider.status || 'active',
        isVerified: rider.is_verified || false,
        totalDeliveries: rider.total_deliveries || 0,
        completedDeliveries: statsMap[rider.id]?.completed || 0,
        failedDeliveries: statsMap[rider.id]?.failed || 0,
        assignedRoutes: assignmentMap[rider.id] || [],
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

  // Profile editing: name/phone → users table; vehicle/hub → riders table
  const updateDriverProfile = useCallback(async (id, { full_name, phone_number, vehicle_info, hub_id }) => {
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('users').update({ full_name, phone_number }).eq('id', id),
        supabase.from('riders').update({ vehicle_info, hub_id: hub_id || null }).eq('id', id),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  const assignRoute = useCallback(async (riderId, routeId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('rider_routes').insert({
        rider_id: riderId, route_id: routeId, assigned_date: today,
      });
      if (error) throw error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  const removeRoute = useCallback(async (riderId, routeId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('rider_routes')
        .delete()
        .eq('rider_id', riderId)
        .eq('route_id', routeId)
        .eq('assigned_date', today);
      if (error) throw error;
      await fetchDrivers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  return {
    drivers, routes, hubs, loading, error,
    updateDriverStatus, updateDriverVerified, updateDriverProfile,
    assignRoute, removeRoute,
    refresh: fetchDrivers,
  };
}
