// ============================================
// FILE: hooks/useWalletStats.js
// ============================================

import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { throwFunctionError } from "../lib/function-errors"
import { withTimeout } from "../lib/query"
import { usePaginatedQuery, NO_MATCHES } from "./usePaginatedQuery"
import { useMinWalletBalance } from "./useMinWalletBalance"
import { resolveUserIdsMatching } from "../lib/postgrest"

const SELECT = `id, user_id, balance, reserved_balance, users!inner(full_name, phone_number)`

const riskOf = (balance, threshold) => {
  // wallets carries CHECK (balance >= 0), so "negative" is unreachable today —
  // kept so the bucket keeps its meaning if that constraint is relaxed.
  if (balance < 0) return "negative"
  if (balance < threshold) return "low"
  return "healthy"
}

export function useWalletStats() {
  const minWalletBalance = useMinWalletBalance()
  const [stats, setStats] = useState({
    totalBalance: 0,
    negativeCount: 0,
    atRiskCount: 0,
    healthyCount: 0,
  })

  // Name/phone live on the embedded users row, which PostgREST can't ilike
  // from here, so resolve them to ids first.
  const prepare = async (filters) => {
    if (!filters.search) return null
    const userIds = await resolveUserIdsMatching(filters.search)
    return userIds.length === 0 ? NO_MATCHES : { userIds }
  }

  const applyFilters = (query, filters, prepared) => {
    if (prepared) query = query.in("user_id", prepared.userIds)
    // balance is a column of `wallets` itself, so risk filters directly.
    if (filters.riskLevel === "negative") query = query.lt("balance", 0)
    else if (filters.riskLevel === "low") {
      query = query.gte("balance", 0).lt("balance", minWalletBalance)
    } else if (filters.riskLevel === "healthy") {
      query = query.gte("balance", minWalletBalance)
    }
    return query
  }

  const transform = useCallback(
    async (wallets) => {
      // Active-subscription counts for just this page's customers. This used to
      // fetch every active subscription in the business on every render.
      const userIds = wallets.map((w) => w.user_id)
      const activeSubsCount = {}
      if (userIds.length) {
        const { data: subs } = await withTimeout(
          supabase
            .from("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .in("user_id", userIds)
        )
        subs?.forEach((s) => {
          activeSubsCount[s.user_id] = (activeSubsCount[s.user_id] || 0) + 1
        })
      }

      return wallets.map((w) => {
        const balance = w.balance ?? 0
        return {
          id: w.user_id,
          name: w.users?.full_name || "Unknown",
          phone: w.users?.phone_number,
          balance,
          reservedBalance: w.reserved_balance ?? 0,
          riskLevel: riskOf(balance, minWalletBalance),
          activeSubscriptions: activeSubsCount[w.user_id] || 0,
        }
      })
    },
    [minWalletBalance]
  )

  const {
    rows: customers,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    updateFilters,
    refresh: refreshList,
  } = usePaginatedQuery({
    table: "wallets",
    select: SELECT,
    initialFilters: { search: "", riskLevel: "all" },
    prepare,
    applyFilters,
    transform,
    orderBy: { column: "balance", ascending: true },
    enabled: minWalletBalance !== null,
  })

  // The stat cards describe EVERY wallet, so they can't be derived from the
  // page. They used to be added up in the browser from a full table fetch —
  // which is exactly why this list could never show more than 20 customers.
  const refreshStats = useCallback(async () => {
    if (minWalletBalance === null) return
    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc("rpc_admin_wallet_totals", { p_threshold: minWalletBalance })
      )
      if (rpcError) throw rpcError
      setStats({
        totalBalance: Number(data?.total_balance ?? 0),
        negativeCount: data?.negative_count ?? 0,
        atRiskCount: data?.at_risk_count ?? 0,
        healthyCount: data?.healthy_count ?? 0,
      })
    } catch (err) {
      console.error("[useWalletStats] totals failed:", err)
    }
  }, [minWalletBalance])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  const refresh = useCallback(
    async (isBackground) => {
      await Promise.all([refreshList(isBackground), refreshStats()])
    },
    [refreshList, refreshStats]
  )

  const addCredit = useCallback(
    async (userId, amount, reason = "Manual credit") => {
      try {
        // A signed delta applied under the wallet's row lock. Reading the
        // balance here and writing back the absolute sum destroyed any charge
        // or credit that landed in between (P-F30 / AD-3.6).
        const { data, error } = await supabase.functions.invoke("admin-db-action", {
          body: {
            action: "rpc",
            fn: "rpc_admin_credit_wallet",
            params: {
              p_user_id: userId,
              p_amount: amount,
              p_note: reason,
              p_create_txn: true,
            },
          },
        })
        if (error) await throwFunctionError(error, data)
        if (data?.error) await throwFunctionError(null, data)

        await refresh()
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [refresh]
  )

  return {
    customers,
    stats,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    minWalletBalance: minWalletBalance ?? 100,
    updateFilters,
    addCredit,
    refresh,
  }
}
