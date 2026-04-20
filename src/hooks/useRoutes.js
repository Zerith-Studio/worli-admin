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

      const { data, error: fetchError } = await supabase
        .from('routes')
        .select(`
          *,
          hubs(name),
          rider_routes!left(
            rider_id,
            riders!inner(
              full_name
            )
          )
        `);

      if (fetchError) throw fetchError;

      // Transform data
      const transformedData = data?.map(route => {
        const assignedRider = route.rider_routes?.[0]?.riders;
        
        return {
          id: route.id,
          name: route.name,
          zone: route.hubs?.name || 'Unknown',
          hubId: route.hub_id,
          driverId: route.rider_routes?.[0]?.rider_id,
          driverName: assignedRider?.full_name,
          stops: 0, // Would need to count addresses
          status: 'pending', // TODO: Calculate based on orders
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
