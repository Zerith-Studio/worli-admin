// ============================================
// FILE: hooks/useRoutes.js
// Added createRoute, updateRoute, toggleRouteActive mutations.
// Mounted guard added.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/query';

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchRoutes = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      // Fetch hubs for dropdowns
      const { data: hubsData } = await supabase.from('hubs').select('id, name').eq('is_active', true).order('name');
      if (mountedRef.current && hubsData) setHubs(hubsData);

      const { data: routesData, error: routesError } = await withTimeout(
        supabase.from('routes').select('*, hubs(name)')
      );
      if (routesError) throw routesError;

      // Fetch today's rider assignments
      const today = new Date().toISOString().split('T')[0];
      const { data: riderRoutesData } = await supabase
        .from('rider_routes')
        .select('route_id, rider_id')
        .eq('assigned_date', today);

      // Resolve rider names
      const riderIds = [...new Set(riderRoutesData?.map(rr => rr.rider_id) || [])];
      let usersMap = {};
      if (riderIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users').select('id, full_name').in('id', riderIds);
        usersData?.forEach(u => { usersMap[u.id] = u; });
      }

      const riderMap = {};
      riderRoutesData?.forEach(rr => {
        riderMap[rr.route_id] = {
          rider_id: rr.rider_id,
          full_name: usersMap[rr.rider_id]?.full_name || 'Unassigned',
        };
      });

      const transformedData = routesData?.map(route => ({
        id: route.id,
        name: route.name,
        hubId: route.hub_id,
        hubName: route.hubs?.name || 'No Hub',
        description: route.description || '',
        isActive: route.is_active,
        driverId: riderMap[route.id]?.rider_id || null,
        driverName: riderMap[route.id]?.full_name || 'Unassigned',
      })) || [];

      if (!mountedRef.current) return;
      setRoutes(transformedData);
    } catch (err) {
      console.error('Error fetching routes:', err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  const createRoute = useCallback(async ({ name, hub_id, description }) => {
    try {
      setSaving(true);
      const { error } = await supabase.from('routes').insert({
        name: name.trim(),
        hub_id: hub_id || null,
        description: description?.trim() || null,
        is_active: true,
      });
      if (error) throw error;
      await fetchRoutes();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [fetchRoutes]);

  const updateRoute = useCallback(async (id, { name, hub_id, description }) => {
    try {
      setSaving(true);
      const { error } = await supabase.from('routes').update({
        name: name.trim(),
        hub_id: hub_id || null,
        description: description?.trim() || null,
      }).eq('id', id);
      if (error) throw error;
      await fetchRoutes();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [fetchRoutes]);

  const toggleRouteActive = useCallback(async (id, currentValue) => {
    try {
      const { error } = await supabase.from('routes').update({ is_active: !currentValue }).eq('id', id);
      if (error) throw error;
      await fetchRoutes();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchRoutes]);

  const assignDriver = useCallback(async (routeId, riderId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('rider_routes').upsert({
        route_id: routeId, rider_id: riderId, assigned_date: today,
      }, { onConflict: 'rider_id,route_id,assigned_date' });
      if (error) throw error;
      await fetchRoutes();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchRoutes]);

  return {
    routes, hubs, loading, error, saving,
    createRoute, updateRoute, toggleRouteActive, assignDriver,
    refresh: fetchRoutes,
  };
}
