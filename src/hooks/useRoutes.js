// ============================================
// FILE: hooks/useRoutes.js
// Hook for fetching routes
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch routes with hub info
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select(`
          *,
          hubs(name)
        `);

      if (routesError) throw routesError;

      // Fetch today's rider assignments with user info
      const today = new Date().toISOString().split('T')[0];
      const { data: riderRoutesData, error: rrError } = await supabase
        .from('rider_routes')
        .select(`
          route_id,
          rider_id
        `)
        .eq('assigned_date', today);

      if (rrError) throw rrError;

      // Get rider IDs that have assignments
      const riderIds = [...new Set(riderRoutesData?.map(rr => rr.rider_id) || [])];
      
      // Fetch users data for those riders (riders.id = users.id)
      let usersMap = {};
      if (riderIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, phone_number')
          .in('id', riderIds);
        
        if (!usersError && usersData) {
          usersData.forEach(u => {
            usersMap[u.id] = u;
          });
        }
      }

      // Create a map of route_id to rider info
      const riderMap = {};
      riderRoutesData?.forEach(rr => {
        const userData = usersMap[rr.rider_id];
        riderMap[rr.route_id] = {
          rider_id: rr.rider_id,
          full_name: userData?.full_name || 'Unassigned',
          phone_number: userData?.phone_number,
        };
      });

      // Transform data
      const transformedData = routesData?.map(route => {
        const assignedRider = riderMap[route.id];

        return {
          id: route.id,
          name: route.name,
          zone: route.hubs?.name || 'Unknown',
          hubId: route.hub_id,
          driverId: assignedRider?.rider_id,
          driverName: assignedRider?.full_name || 'Unassigned',
          driverPhone: assignedRider?.phone_number,
          stops: 0, // Would need to count addresses
          status: assignedRider ? 'assigned' : 'pending',
          description: route.description,
          isActive: route.is_active,
        };
      }) || [];

      setRoutes(transformedData);
    } catch (err) {
      console.error('Error fetching routes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const assignDriver = useCallback(async (routeId, riderId) => {
    try {
      // First, deactivate any existing assignments for this route today
      const today = new Date().toISOString().split('T')[0];
      
      // Insert new rider route assignment
      const { error } = await supabase
        .from('rider_routes')
        .insert({
          route_id: routeId,
          rider_id: riderId,
          assigned_date: today,
        });

      if (error) throw error;

      await fetchRoutes();
      return { success: true };
    } catch (err) {
      console.error('Error assigning driver:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRoutes]);

  return {
    routes,
    loading,
    error,
    assignDriver,
    refresh: fetchRoutes,
  };
}
