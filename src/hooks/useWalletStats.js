// ============================================
// FILE: hooks/useWalletStats.js
// Dynamic threshold from app_settings.min_wallet_balance.
// Mounted guard added.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

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

  const fetchWalletStats = useCallback(async () => {
    try {
      setLoading(true);
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

      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('*, users!inner(full_name, phone_number)');
      if (walletsError) throw walletsError;

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active');
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
        .from('wallets').select('*').eq('user_id', userId).single();
      if (walletError) throw walletError;

      const balanceBefore = wallet?.balance ?? 0;
      const newBalance = balanceBefore + amount;

      const { error: updateError } = await supabase
        .from('wallets').update({ balance: newBalance }).eq('user_id', userId);
      if (updateError) throw updateError;

      const { error: txnError } = await supabase.from('transactions').insert({
        transaction_id: `ADM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        wallet_id: wallet?.id,
        type: 'credit',
        amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        description: reason,
        payment_method: 'admin_adjustment',
        status: 'completed',
      });
      if (txnError) throw txnError;

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
