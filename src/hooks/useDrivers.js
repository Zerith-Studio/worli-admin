// ============================================
// FILE: hooks/useDrivers.js
// Hook for fetching riders/drivers
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all riders
      const { data: ridersData, error: ridersError } = await supabase
        .from('riders')
        .select(`
          *,
          hubs(name)
        `);

      if (ridersError) throw ridersError;

      // Get users data for phone numbers
      const riderIds = ridersData?.map(r => r.id) || [];
      let usersMap = {};
      
      if (riderIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, phone_number, full_name')
          .in('id', riderIds);
        
        if (!usersError && usersData) {
          usersData.forEach(u => {
            usersMap[u.id] = u;
          });
        }
      }

      // Transform data
      const transformedData = ridersData?.map(rider => {
        const userData = usersMap[rider.id];
        return {
          id: rider.id,
          name: rider.full_name || userData?.full_name || 'Unnamed',
          phone: rider.phone_number || userData?.phone_number || 'N/A',
          zone: rider.hubs?.name || 'Unassigned',
          status: rider.status || 'active',
          vehicle: rider.vehicle_info || 'Unknown',
          rating: rider.rating || 5.0,
          deliveries: rider.total_deliveries || 0,
          isVerified: rider.is_verified || false,
          hubId: rider.hub_id,
        };
      }) || [];

      setDrivers(transformedData);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const updateDriverStatus = useCallback(async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('riders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      await fetchDrivers();
      return { success: true };
    } catch (err) {
      console.error('Error updating driver status:', err);
      return { success: false, error: err.message };
    }
  }, [fetchDrivers]);

  return {
    drivers,
    loading,
    error,
    updateDriverStatus,
    refresh: fetchDrivers,
  };
}
