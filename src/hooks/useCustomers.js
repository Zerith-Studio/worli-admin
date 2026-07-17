// ============================================
// FILE: hooks/useCustomers.js
// ============================================

import { useCallback } from "react"
import { supabase } from "../lib/supabase"
import { throwFunctionError } from "../lib/function-errors"
import { usePaginatedQuery } from "./usePaginatedQuery"
import { useMinWalletBalance } from "./useMinWalletBalance"
import { userSearchClause } from "../lib/postgrest"

// wallets!inner is load-bearing: the status filter below constrains an embedded
// column, and only an inner embed makes that constrain the parent's row count
// too. Every user has a wallet (an INSERT trigger on users creates it), so the
// inner join drops nobody.
const SELECT = `
  id, full_name, phone_number, email, bottles_pending, created_at, is_active,
  wallets!inner(balance, auto_recharge_enabled, razorpay_token_id, auto_recharge_amount, auto_recharge_trigger_amount),
  addresses(city, is_default),
  subscriptions!left(id, status)
`

/** The wallet balance buckets the status filter exposes. */
const statusOf = (balance, threshold) => {
  // NOTE: wallets carries CHECK (balance >= 0), so "inactive" is unreachable —
  // kept only so the bucket doesn't silently change meaning if that constraint
  // is ever relaxed.
  if (balance < 0) return "inactive"
  if (balance < threshold) return "at_risk"
  return "active"
}

export function useCustomers() {
  const minWalletBalance = useMinWalletBalance()

  // Synchronous: query builders are thenable, so an `async` here would make the
  // promise machinery execute the query and return a response instead of the
  // builder. Nothing in here needs to await anyway — the status filter works
  // off wallets.balance, which the embed already provides.
  const applyFilters = (query, filters) => {
    if (filters.search) {
      // Quoted: an unquoted term containing , . ( ) makes PostgREST reject the
      // entire logic tree, which breaks search rather than just matching nothing.
      query = query.or(userSearchClause(filters.search))
    }

    // Status is derived from wallet balance, so it must filter server-side.
    // This used to run in JS AFTER .range(), which picked matches out of a page
    // of ALL users: "at risk" showed a handful of rows while the page count
    // still described every customer, and most at-risk customers sat on pages
    // nobody would think to open.
    if (filters.status === "inactive") {
      query = query.lt("wallets.balance", 0)
    } else if (filters.status === "at_risk") {
      query = query.gte("wallets.balance", 0).lt("wallets.balance", minWalletBalance)
    } else if (filters.status === "active") {
      query = query.gte("wallets.balance", minWalletBalance)
    }
    return query
  }

  const transform = useCallback(
    (data) =>
      data.map((user) => {
        // wallets is a 1-1 relation but PostgREST may return array or object
        const walletRaw = user.wallets
        const wallet = Array.isArray(walletRaw) ? walletRaw[0] : walletRaw
        const balance = wallet?.balance ?? 0

        const defaultAddress =
          user.addresses?.find((a) => a.is_default) || user.addresses?.[0]
        const activeSubs = user.subscriptions?.filter((s) => s.status === "active") || []

        return {
          id: user.id,
          name: user.full_name || "Unnamed",
          phone: user.phone_number,
          email: user.email,
          city: defaultAddress?.city || "—",
          wallet: balance,
          bottles_pending: user.bottles_pending || 0,
          isActive: user.is_active !== false, // treat null/undefined as true
          status: statusOf(balance, minWalletBalance),
          joined: user.created_at?.split("T")[0],
          totalOrders: user.subscriptions?.length || 0,
          activeSubscriptions: activeSubs.length,
          auto_recharge_enabled: wallet?.auto_recharge_enabled || false,
          razorpay_token_id: wallet?.razorpay_token_id,
          auto_recharge_amount: wallet?.auto_recharge_amount,
          auto_recharge_trigger_amount: wallet?.auto_recharge_trigger_amount,
        }
      }),
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
    refresh: fetchCustomers,
  } = usePaginatedQuery({
    table: "users",
    select: SELECT,
    initialFilters: { search: "", status: "all" },
    applyFilters,
    transform,
    // Hold the query until the threshold is known — otherwise the first page
    // buckets everyone against a guess and the status filter targets it too.
    enabled: minWalletBalance !== null,
  })

  const updateUserStatus = useCallback(
    async (userId, isActive) => {
      try {
        const { error } = await supabase
          .from("users")
          .update({ is_active: isActive })
          .eq("id", userId)
        if (error) throw error
        await fetchCustomers(true)
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchCustomers]
  )

  const triggerAutoRecharge = useCallback(
    async (userId) => {
      try {
        const { data, error } = await supabase.functions.invoke("trigger-autopay-charge", {
          body: { user_id: userId },
        })
        if (error) await throwFunctionError(error, data)
        if (!data?.triggered) throw new Error(data?.reason || "Failed to trigger recharge")
        await fetchCustomers(true)
        return { success: true, amount_charged: data.amount_charged }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchCustomers]
  )

  return {
    customers,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    minWalletBalance: minWalletBalance ?? 100,
    updateFilters,
    updateUserStatus,
    triggerAutoRecharge,
    refresh: fetchCustomers,
  }
}
