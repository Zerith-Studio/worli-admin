// ============================================
// FILE: hooks/useRouteStops.js
// Hook for managing stops within a route.
// Fetches stops for a given routeId; exposes CRUD + reorder.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRouteStops(routeId) {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchStops = useCallback(async () => {
    if (!routeId) { setStops([]); return; }
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('route_stops')
        .select('*')
        .eq('route_id', routeId)
        .order('sequence_order', { ascending: true });
      if (fetchError) throw fetchError;
      if (!mountedRef.current) return;
      setStops(data || []);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [routeId]);

  useEffect(() => { fetchStops(); }, [fetchStops]);

  const addStop = useCallback(async ({ name, address, map_url, notes }) => {
    if (!routeId) return { success: false, error: 'No route selected' };
    try {
      setSaving(true);
      const maxOrder = stops.length > 0
        ? Math.max(...stops.map(s => s.sequence_order))
        : 0;
      const { error } = await supabase.from('route_stops').insert({
        route_id: routeId,
        name: name.trim(),
        address: address?.trim() || null,
        map_url: map_url?.trim() || null,
        notes: notes?.trim() || null,
        sequence_order: maxOrder + 1,
        is_active: true,
      });
      if (error) throw error;
      await fetchStops();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [routeId, stops, fetchStops]);

  const updateStop = useCallback(async (id, { name, address, map_url, notes, sequence_order }) => {
    try {
      setSaving(true);
      const { error } = await supabase.from('route_stops').update({
        name: name.trim(),
        address: address?.trim() || null,
        map_url: map_url?.trim() || null,
        notes: notes?.trim() || null,
        sequence_order: parseInt(sequence_order, 10) || 1,
      }).eq('id', id);
      if (error) throw error;
      await fetchStops();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [fetchStops]);

  const deleteStop = useCallback(async (id) => {
    try {
      const { error } = await supabase.from('route_stops').delete().eq('id', id);
      if (error) throw error;
      await fetchStops();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchStops]);

  const toggleStopActive = useCallback(async (id, currentValue) => {
    try {
      const { error } = await supabase
        .from('route_stops').update({ is_active: !currentValue }).eq('id', id);
      if (error) throw error;
      await fetchStops();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchStops]);

  // Swap sequence_order of two adjacent stops
  const moveStop = useCallback(async (id, direction) => {
    const idx = stops.findIndex(s => s.id === id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= stops.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const a = stops[idx];
    const b = stops[swapIdx];

    try {
      await Promise.all([
        supabase.from('route_stops').update({ sequence_order: b.sequence_order }).eq('id', a.id),
        supabase.from('route_stops').update({ sequence_order: a.sequence_order }).eq('id', b.id),
      ]);
      await fetchStops();
    } catch (err) {
      console.error('Error reordering stops:', err);
    }
  }, [stops, fetchStops]);

  return {
    stops, loading, error, saving,
    addStop, updateStop, deleteStop, toggleStopActive, moveStop,
    refresh: fetchStops,
  };
}
