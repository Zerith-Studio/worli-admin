// ============================================
// FILE: hooks/useSubscriptions.js
// Fixed: default status=active, working search via 2-step user
// query, pagination, mounted guard.
// ============================================

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"
import { withTimeout } from "../lib/query"

const PAGE_SIZE = 15

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "active", // default to active
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchSubscriptions = useCallback(async (isBackground = false) => {
    try {
      console.log(
        `[useSubscriptions] fetch started. mounted=${mountedRef.current}`,
      )
      if (!isBackground) setLoading(true)
      setError(null)

      let query = supabase.from("subscriptions").select(
        `
          *,
          users!inner(full_name, phone_number),
          products!inner(name, volume, price),
          addresses!left(city)
        `,
        { count: "exact" },
      )

      if (filters.type !== "all") query = query.eq("frequency", filters.type)
      if (filters.status !== "all") query = query.eq("status", filters.status)

      // Search filter: PostgREST can't ilike on joined tables,
      // so we resolve user IDs first.
      let userIdFilter = null
      if (filters.search) {
        const { data: matchedUsers } = await supabase
          .from("users")
          .select("id")
          .or(
            `full_name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`,
          )

        userIdFilter = matchedUsers?.map((u) => u.id) || []
        if (userIdFilter.length === 0) {
          if (mountedRef.current) {
            setSubscriptions([])
            setTotalCount(0)
            setLoading(false)
          }
          return
        }
      }

      if (userIdFilter !== null) query = query.in("user_id", userIdFilter)

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const {
        data,
        error: fetchError,
        count,
      } = await withTimeout(query.range(from, to).order("created_at", { ascending: false }))

      if (fetchError) throw fetchError
      if (!mountedRef.current) return

      const transformedData =
        data?.map((sub) => ({
          id: sub.id,
          customerId: sub.user_id,
          customerName: sub.users?.full_name || "Unknown",
          customerPhone: sub.users?.phone_number,
          city: sub.addresses?.city || "—",
          productId: sub.product_id,
          productName: sub.products?.name || "Unknown",
          productUnit: sub.products?.volume || "",
          quantity: sub.quantity || 1,
          type: sub.frequency || "daily",
          status: sub.status || "active",
          startDate: sub.start_date,
          price: (sub.products?.price || 0) * (sub.quantity || 1),
          discountAmount: sub.discount_amount || 0,
          remainingBottles: sub.remaining_bottles,
          intervalDays: sub.interval_days,
          pausedDates: sub.paused_dates || [],
        })) || []

      setSubscriptions(transformedData)
      setTotalCount(count || 0)
      console.log("[useSubscriptions] fetch success")
    } catch (err) {
      console.error("Error fetching subscriptions:", err)
      if (mountedRef.current) setError(err.message)
    } finally {
      if (mountedRef.current) {
        console.log("[useSubscriptions] Setting loading: false")
        setLoading(false)
      }
    }
  }, [page, filters])

  useEffect(() => {
    console.log("[useSubscriptions] initial fetch")
    fetchSubscriptions()
  }, [fetchSubscriptions])

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

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPage(1)
  }, [])

  const goToPage = useCallback((newPage) => {
    setPage(newPage)
  }, [])
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    subscriptions,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    filters,
    updateFilters,
    goToPage,
    updateSubscriptionStatus,
    refresh: fetchSubscriptions,
  }
}
