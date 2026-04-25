// ============================================
// FILE: hooks/useWalletStats.js
// Hook for fetching wallet statistics
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 20;

export function useWalletStats() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({
    totalBalance: 0,
    negativeCount: 0,
    atRiskCount: 0,
    healthyCount: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    riskLevel: 'all', // 'all' | 'negative' | 'low' | 'healthy'
  });

  const fetchWalletStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch wallets with user info
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select(`
          *,
          users!inner(full_name, phone_number)
        `);

      if (walletsError) throw walletsError;

      // Fetch active subscriptions count per user
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('user_id, status')
        .eq('status', 'active');

      if (subsError) throw subsError;

      // Count active subscriptions per user
      const activeSubsCount = {};
      subscriptions?.forEach(sub => {
        activeSubsCount[sub.user_id] = (activeSubsCount[sub.user_id] || 0) + 1;
      });

      // Transform and filter
      let transformedData = wallets?.map(wallet => {
        const balance = wallet.balance || 0;

        let riskLevel = 'healthy';
        if (balance < 0) riskLevel = 'negative';
        else if (balance < 200) riskLevel = 'low';

        return {
          id: wallet.user_id,
          name: wallet.users?.full_name || 'Unknown',
          phone: wallet.users?.phone_number,
          balance,
          riskLevel,
          activeSubscriptions: activeSubsCount[wallet.user_id] || 0,
          zone: 'Unknown', // Would need address lookup
        };
      }) || [];

      // Apply filters
      if (filters.search) {
        transformedData = transformedData.filter(c => 
          c.name.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      if (filters.riskLevel !== 'all') {
        transformedData = transformedData.filter(c => c.riskLevel === filters.riskLevel);
      }

      // Calculate stats
      const totalBalance = transformedData.reduce((sum, c) => sum + c.balance, 0);
      const negativeCount = transformedData.filter(c => c.balance < 0).length;
      const atRiskCount = transformedData.filter(c => c.balance >= 0 && c.balance < 200).length;
      const healthyCount = transformedData.filter(c => c.balance >= 200).length;

      setStats({
        totalBalance,
        negativeCount,
        atRiskCount,
        healthyCount,
      });

      // Paginate
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      setCustomers(transformedData.slice(from, to));
    } catch (err) {
      console.error('Error fetching wallet stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchWalletStats();
  }, [fetchWalletStats]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const goToPage = useCallback((newPage) => {
    setPage(newPage);
  }, []);

  const addCredit = useCallback(async (userId, amount, reason = 'Manual credit') => {
    try {
      // Get current wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (walletError) throw walletError;

      const balanceBefore = wallet?.balance || 0;
      const newBalance = balanceBefore + amount;

      // Update wallet balance
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Create transaction record
      const { error: txnError } = await supabase
        .from('transactions')
        .insert({
          transaction_id: `ADM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          wallet_id: wallet?.id,
          type: 'credit',
          amount: amount,
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
      console.error('Error adding credit:', err);
      return { success: false, error: err.message };
    }
  }, [fetchWalletStats]);

  return {
    customers,
    stats,
    loading,
    error,
    page,
    filters,
    updateFilters,
    goToPage,
    addCredit,
    refresh: fetchWalletStats,
  };
}
