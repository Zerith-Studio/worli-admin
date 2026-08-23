// ============================================
// FILE: hooks/useSubscriptions.js
// ============================================

import { useCallback } from "react"
import { supabase } from "../lib/supabase"
import { usePaginatedQuery, NO_MATCHES } from "./usePaginatedQuery"
import { resolveUserIdsMatching } from "../lib/postgrest"
import { istToday } from "../utils/formatters"

const SELECT = `
  *,
  users!inner(full_name, phone_number),
  products!inner(name, volume, price),
  addresses!left(city)
`

export function useSubscriptions() {
  // PostgREST can't ilike an embedded table's column inside this query's
  // filter, so the customer half of the search resolves to ids first.
  // resolveUserIdsMatching quotes the term (an unquoted `,` or `(` breaks the
  // whole logic tree) and caps the id list, neither of which this did before.
  const prepare = async (filters) => {
    if (!filters.search) return null
    const userIds = await resolveUserIdsMatching(filters.search)
    return userIds.length === 0 ? NO_MATCHES : { userIds }
  }

  const applyFilters = (query, filters, prepared) => {
    if (filters.type !== "all") query = query.eq("frequency", filters.type)
    if (filters.status !== "all") query = query.eq("status", filters.status)
    if (prepared) query = query.in("user_id", prepared.userIds)
    return query
  }

  const transform = useCallback(async (data) => {
      const transformedData =
        data?.map((sub) => ({
          id: sub.id,
          customerId: sub.user_id,
          customerName: sub.users?.full_name || 'Unknown',
          customerPhone: sub.users?.phone_number,
          city: sub.addresses?.city || '—',
          productId: sub.product_id,
          productName: sub.products?.name || 'Unknown',
          productUnit: sub.products?.volume || '',
          quantity: sub.quantity || 1,
          type: sub.frequency || 'daily',
          status: sub.status || 'active',
          startDate: sub.start_date,
          endDate: sub.end_date,
          durationMonths: sub.duration_months,
          durationDays: sub.duration_days,
          price: (sub.products?.price || 0) * (sub.quantity || 1),
          discountAmount: sub.discount_amount || 0,
          remainingBottles: sub.remaining_bottles,
          intervalDays: sub.interval_days,
          activePause: null, // filled below for paused subs
        })) || []

      // Fetch active holds for paused subscriptions
      const pausedIds = transformedData.filter(s => s.status === 'paused').map(s => s.id)
      if (pausedIds.length > 0) {
        const today = istToday()
        const { data: holdsData } = await supabase
          .from('subscription_holds')
          .select('subscription_id, start_date, end_date')
          .in('subscription_id', pausedIds)
          .lte('start_date', today)
          .gte('end_date', today)
          .order('start_date', { ascending: false })
        // Map latest hold per subscription
        const holdsMap = {}
        holdsData?.forEach(h => {
          if (!holdsMap[h.subscription_id]) holdsMap[h.subscription_id] = h
        })
        transformedData.forEach(s => { s.activePause = holdsMap[s.id] || null })
      }

      return transformedData
  }, [])

  const {
    rows: subscriptions,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    updateFilters,
    refresh: fetchSubscriptions,
  } = usePaginatedQuery({
    table: "subscriptions",
    select: SELECT,
    initialFilters: { search: "", type: "all", status: "active" },
    prepare,
    applyFilters,
    transform,
  })

  const updateSubscriptionStatus = useCallback(
    async (id, newStatus, holdData = null) => {
      try {
        if (newStatus === "paused" && holdData) {
          const { error: holdError } = await supabase
            .from("subscription_holds")
            .insert({
              subscription_id: id,
              start_date: holdData.start_date,
              end_date: holdData.end_date,
              reason: holdData.reason || "Admin hold",
            })
          if (holdError) throw holdError
          // Update subscription status too
          const { error: statusError } = await supabase
            .from("subscriptions")
            .update({ status: "paused" })
            .eq("id", id)
          if (statusError) throw statusError
        } else {
          const { error } = await supabase
            .from("subscriptions")
            .update({ status: newStatus })
            .eq("id", id)
          if (error) throw error
        }
        await fetchSubscriptions()
        return { success: true }
      } catch (err) {
        console.error("Error updating subscription:", err)
        return { success: false, error: err.message }
      }
    },
    [fetchSubscriptions],
  )

  return {
    subscriptions,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    updateFilters,
    updateSubscriptionStatus,
    refresh: fetchSubscriptions,
  }
}
