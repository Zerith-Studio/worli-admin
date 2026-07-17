// ============================================
// FILE: hooks/useRoutes.js
// Added createRoute, updateRoute, toggleRouteActive mutations.
//
// The route list is server-paginated through usePaginatedQuery. The rider
// resolution that used to run over every route now runs inside `transform`, so
// it only asks about the ~20 routes on the current page instead of pulling the
// whole rider_routes table on every refresh.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { usePaginatedQuery } from './usePaginatedQuery';

export function useRoutes() {
  const [hubs, setHubs] = useState([]);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Hubs feed the create/edit dropdown, not the table — bounded by the active
  // hub count and independent of which page of routes is on screen.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('hubs').select('id, name').eq('is_active', true).order('name');
      if (mountedRef.current && data) setHubs(data);
    })();
  }, []);

  const {
    rows: routes,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    refresh: fetchRoutes,
  } = usePaginatedQuery({
    table: 'routes',
    select: '*, hubs(name)',
    orderBy: { column: 'created_at', ascending: false },
    transform: async (routesData) => {
      if (routesData.length === 0) return [];

      // Rider assignments for THIS page's routes: permanent (assigned_date IS
      // NULL) + today's overrides.
      const today = new Date().toISOString().split('T')[0];
      const routeIds = routesData.map(r => r.id);
      const { data: riderRoutesData } = await supabase
        .from('rider_routes')
        .select('route_id, rider_id, assigned_date')
        .in('route_id', routeIds)
        .or(`assigned_date.is.null,assigned_date.eq.${today}`);

      // Resolve rider names
      const riderIds = [...new Set(riderRoutesData?.map(rr => rr.rider_id) || [])];
      const usersMap = {};
      if (riderIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users').select('id, full_name').in('id', riderIds);
        usersData?.forEach(u => { usersMap[u.id] = u; });
      }

      // Effective driver per route = today's override wins over permanent.
      const permMap = {};
      const overrideMap = {};
      riderRoutesData?.forEach(rr => {
        if (rr.assigned_date === null) permMap[rr.route_id] = rr.rider_id;
        else overrideMap[rr.route_id] = rr.rider_id;
      });

      return routesData.map(route => {
        const effectiveRiderId = overrideMap[route.id] ?? permMap[route.id] ?? null;
        return {
          id: route.id,
          name: route.name,
          hubId: route.hub_id,
          hubName: route.hubs?.name || 'No Hub',
          description: route.description || '',
          isActive: route.is_active,
          driverId: effectiveRiderId,
          driverName: effectiveRiderId ? (usersMap[effectiveRiderId]?.full_name || 'Unassigned') : 'Unassigned',
          isOverriddenToday: overrideMap[route.id] != null,
        };
      });
    },
  });

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
      await fetchRoutes(true);
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
      await fetchRoutes(true);
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
      await fetchRoutes(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchRoutes]);

  // Assign the route's standing (permanent) driver from the Routes page.
  const assignDriver = useCallback(async (routeId, riderId) => {
    try {
      const { error } = await supabase.rpc('set_permanent_route', {
        p_route_id: routeId, p_rider_id: riderId,
      });
      if (error) throw error;
      await fetchRoutes(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchRoutes]);

  return {
    routes, hubs, loading, error, saving,
    totalCount, loadingMore, hasMore, loadMore,
    createRoute, updateRoute, toggleRouteActive, assignDriver,
    refresh: fetchRoutes,
  };
}
