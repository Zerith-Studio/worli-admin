// ============================================
// FILE: hooks/useWalletStats.js
// Dynamic threshold from app_settings.min_wallet_balance.
// Mounted guard added.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { throwFunctionError } from '../lib/function-errors';
import { withTimeout } from '../lib/query';

const PAGE_SIZE = 20;

export function useWalletStats() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [minWalletBalance, setMinWalletBalance] = useState(100);
  const [stats, setStats] = useState({ totalBalance: 0, negativeCount: 0, atRiskCount: 0, healthyCount: 0 });
  const [filters, setFilters] = useState({ search: '', riskLevel: 'all' });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchWalletStats = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      // Fetch dynamic threshold
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'min_wallet_balance')
        .maybeSingle();
      const threshold = parseFloat(settingData?.setting_value || '100');
      if (!mountedRef.current) return;
      setMinWalletBalance(threshold);

      const [{ data: wallets, error: walletsError }, { data: subscriptions }] = await withTimeout(Promise.all([
        supabase.from('wallets').select('id, user_id, balance, reserved_balance, users!inner(full_name, phone_number)'),
        supabase.from('subscriptions').select('user_id').eq('status', 'active'),
      ]));
      if (walletsError) throw walletsError;
      const activeSubsCount = {};
      subscriptions?.forEach(sub => {
        activeSubsCount[sub.user_id] = (activeSubsCount[sub.user_id] || 0) + 1;
      });

      let transformed = wallets?.map(wallet => {
        const balance = wallet.balance ?? 0;
        let riskLevel = 'healthy';
        if (balance < 0) riskLevel = 'negative';
        else if (balance < threshold) riskLevel = 'low';

        return {
          id: wallet.user_id,
          name: wallet.users?.full_name || 'Unknown',
          phone: wallet.users?.phone_number,
          balance,
          reservedBalance: wallet.reserved_balance ?? 0,
          riskLevel,
          activeSubscriptions: activeSubsCount[wallet.user_id] || 0,
        };
      }) || [];

      if (filters.search) {
        const q = filters.search.toLowerCase();
        transformed = transformed.filter(c =>
          c.name.toLowerCase().includes(q) || c.phone?.includes(filters.search)
        );
      }
      if (filters.riskLevel !== 'all') {
        transformed = transformed.filter(c => c.riskLevel === filters.riskLevel);
      }

      const totalBalance = transformed.reduce((sum, c) => sum + c.balance, 0);
      const negativeCount = transformed.filter(c => c.balance < 0).length;
      const atRiskCount = transformed.filter(c => c.balance >= 0 && c.balance < threshold).length;
      const healthyCount = transformed.filter(c => c.balance >= threshold).length;

      if (!mountedRef.current) return;
      setStats({ totalBalance, negativeCount, atRiskCount, healthyCount });

      const from = (page - 1) * PAGE_SIZE;
      setCustomers(transformed.slice(from, from + PAGE_SIZE));
    } catch (err) {
      console.error('Error fetching wallet stats:', err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchWalletStats(); }, [fetchWalletStats]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const addCredit = useCallback(async (userId, amount, reason = 'Manual credit') => {
    try {
      const { data: wallet, error: walletError } = await supabase
        .from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (walletError) throw walletError;

      const balanceBefore = wallet?.balance ?? 0;
      const newBalance = balanceBefore + amount;

      const { data, error } = await supabase.functions.invoke('admin-db-action', {
        body: {
          action: 'rpc',
          fn: 'rpc_admin_adjust_wallet',
          params: {
            p_user_id: userId,
            p_new_balance: newBalance,
            p_create_txn: true,
            p_note: reason,
          },
        },
      });
      if (error) await throwFunctionError(error, data);
      if (data?.error) await throwFunctionError(null, data);

      await fetchWalletStats();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchWalletStats]);

  return {
    customers, stats, loading, error, page, filters,
    minWalletBalance,
    updateFilters, addCredit,
    refresh: fetchWalletStats,
  };
}
