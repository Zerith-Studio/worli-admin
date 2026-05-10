// ============================================
// FILE: hooks/useHubs.js
// Hook for fetching and managing hubs
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useHubs() {
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchHubs = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('hubs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (!mountedRef.current) return;
      setHubs(data || []);
    } catch (err) {
      console.error('Error fetching hubs:', err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHubs(); }, [fetchHubs]);

  const createHub = useCallback(async ({ name, address, contact_number }) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('hubs')
        .insert({ name: name.trim(), address: address?.trim() || null, contact_number: contact_number?.trim() || null });
      if (error) throw error;
      await fetchHubs();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [fetchHubs]);

  const updateHub = useCallback(async (id, { name, address, contact_number }) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('hubs')
        .update({ name: name.trim(), address: address?.trim() || null, contact_number: contact_number?.trim() || null })
        .eq('id', id);
      if (error) throw error;
      await fetchHubs();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [fetchHubs]);

  const toggleHubActive = useCallback(async (id, currentValue) => {
    try {
      const { error } = await supabase
        .from('hubs')
        .update({ is_active: !currentValue })
        .eq('id', id);
      if (error) throw error;
      await fetchHubs();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchHubs]);

  return { hubs, loading, error, saving, createHub, updateHub, toggleHubActive, refresh: fetchHubs };
}
