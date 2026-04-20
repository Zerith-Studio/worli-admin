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

      const { data, error: fetchError } = await supabase
        .from('riders')
        .select(`
          *,
          users!inner(phone_number),
          hubs(name)
        `);

      if (fetchError) throw fetchError;

      // Transform data
      const transformedData = data?.map(rider => ({
        id: rider.id,
        name: rider.full_name || 'Unnamed',
        phone: rider.users?.phone_number,
        zone: rider.hubs?.name || 'Unassigned',
        status: rider.status || 'active',
        vehicle: rider.vehicle_info || 'Unknown',
        rating: rider.rating || 5.0,
        deliveries: rider.total_deliveries || 0,
        isVerified: rider.is_verified || false,
        hubId: rider.hub_id,
      })) || [];

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
