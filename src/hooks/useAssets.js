// ============================================
// FILE: hooks/useAssets.js
// Bottle/asset tracking.
//
// This used to fetch every bottle_return, every user, and EVERY delivered order
// in the database, join them in JavaScript, then display the first 20 rows and
// discard the rest. Both the per-customer figures and the stat cards are
// aggregates, so they're computed in the database now (rpc_admin_bottle_rows /
// rpc_admin_bottle_totals) and the list appends a batch at a time.
//
// It doesn't use usePaginatedQuery because its rows come from an RPC rather
// than a table select, but the loading model is deliberately identical.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/query';
import { useRowsPerLoad } from '../lib/rows-per-load';

const riskOf = (pending) => {
  if (pending > 3) return 'high';
  if (pending > 1) return 'medium';
  return 'low';
};

const mapRow = (r) => {
  const issued = Number(r.issued) || 0;
  const returned = Number(r.returned) || 0;
  const pending = Number(r.pending) || 0;
  return {
    id: r.id,
    name: r.name,
    zone: r.zone,
    issued,
    returned,
    pending,
    returnRate: issued > 0 ? Math.round((returned / issued) * 100) : 100,
    risk: riskOf(pending),
  };
};

export function useAssets() {
  const batchSize = useRowsPerLoad();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ search: '', risk: 'all' });
  const [rawReturns, setRawReturns] = useState([]);
  const [stats, setStats] = useState({
    totalIssued: 0,
    totalReturned: 0,
    totalPending: 0,
    highOverdue: 0,
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const generationRef = useRef(0);
  const loadedRef = useRef(0);

  /** Loads rows [offset, offset+limit), replacing or appending. */
  const fetchWindow = useCallback(async (offset, limit, mode, isBackground = false) => {
    const generation = ++generationRef.current;
    const isAppend = mode === 'append';
    try {
      if (isAppend) setLoadingMore(true);
      else if (!isBackground) setLoading(true);
      setError(null);

      const [rowsRes, totalsRes, returnsRes] = await withTimeout(Promise.all([
        supabase.rpc('rpc_admin_bottle_rows', {
          p_search: filters.search || null,
          p_risk: filters.risk,
          p_limit: limit,
          p_offset: offset,
        }),
        supabase.rpc('rpc_admin_bottle_totals'),
        // The outstanding-collection panel above the table. Bounded by status,
        // and these are requests awaiting action rather than history, so the
        // set stays small.
        supabase
          .from('bottle_returns')
          .select(`
            id, user_id, quantity, status, return_date, notes,
            addresses (address_line1, city, route_stop_id),
            routes (name),
            route_stops (name),
            users:user_id (full_name, phone_number)
          `)
          .in('status', ['requested', 'pending'])
          .order('return_date', { ascending: true })
          .limit(200),
      ]));

      if (rowsRes.error) throw rowsRes.error;
      if (totalsRes.error) throw totalsRes.error;
      if (returnsRes.error) throw returnsRes.error;
      if (!mountedRef.current || generation !== generationRef.current) return;

      const rows = (rowsRes.data?.rows ?? []).map(mapRow);

      if (isAppend) {
        setAssets((prev) => {
          // De-duplicate: offset windows shift if a customer's bottles_pending
          // changes between batches (the list is ordered by it), which would
          // otherwise re-send a row already on screen.
          const seen = new Set(prev.map((r) => r.id));
          const next = [...prev, ...rows.filter((r) => !seen.has(r.id))];
          loadedRef.current = next.length;
          return next;
        });
      } else {
        setAssets(rows);
        loadedRef.current = rows.length;
      }

      setTotalCount(rowsRes.data?.total ?? 0);
      setRawReturns(returnsRes.data || []);

      const t = totalsRes.data ?? {};
      setStats({
        totalIssued: Number(t.total_issued) || 0,
        totalReturned: Number(t.total_returned) || 0,
        totalPending: Number(t.total_pending) || 0,
        highOverdue: Number(t.high_overdue) || 0,
      });
    } catch (err) {
      console.error('Error fetching assets:', err);
      if (mountedRef.current && generation === generationRef.current) setError(err.message);
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filters]);

  // First batch — and again whenever the filters or the batch size change, each
  // of which invalidates every row already on screen.
  useEffect(() => {
    loadedRef.current = 0;
    fetchWindow(0, batchSize, 'replace');
  }, [fetchWindow, batchSize]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    const offset = loadedRef.current;
    if (offset === 0) return;
    fetchWindow(offset, batchSize, 'append');
  }, [fetchWindow, batchSize, loading, loadingMore]);

  // Re-reads everything on screen, so a mutation or the 60s auto-refresh does
  // not collapse a list someone has scrolled through.
  const refresh = useCallback(
    (isBackground = false) =>
      fetchWindow(0, Math.max(loadedRef.current, batchSize), 'replace', isBackground),
    [fetchWindow, batchSize]
  );

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => {
      const next = { ...prev, ...newFilters };
      return Object.keys(next).every((k) => next[k] === prev[k]) ? prev : next;
    });
  }, []);

  const assignBottleReturn = async (returnId, updates) => {
    try {
      const { error } = await supabase
        .from('bottle_returns')
        .update(updates)
        .eq('id', returnId);
      if (error) throw error;
      await refresh(true);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  return {
    assets,
    rawReturns,
    stats,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore: assets.length < totalCount,
    loadMore,
    filters,
    updateFilters,
    refresh,
    assignBottleReturn,
  };
}
