// ============================================
// FILE: hooks/useHubs.js
// Hook for fetching and managing hubs.
//
// The list is server-paginated through usePaginatedQuery: hubs is small today,
// but "small today" is exactly how the other lists ended up silently capped at
// PostgREST's max-rows ceiling with nobody noticing.
// ============================================

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { usePaginatedQuery } from './usePaginatedQuery';

export function useHubs() {
  const [saving, setSaving] = useState(false);

  const {
    rows: hubs,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    refresh: fetchHubs,
  } = usePaginatedQuery({
    table: 'hubs',
    select: '*',
    orderBy: { column: 'created_at', ascending: false },
  });

  const createHub = useCallback(async ({ name, address, contact_number }) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('hubs')
        .insert({ name: name.trim(), address: address?.trim() || null, contact_number: contact_number?.trim() || null });
      if (error) throw error;
      await fetchHubs(true);
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
      await fetchHubs(true);
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
      await fetchHubs(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchHubs]);

  return {
    hubs, loading, error, saving,
    totalCount, loadingMore, hasMore, loadMore,
    createHub, updateHub, toggleHubActive, refresh: fetchHubs,
  };
}
