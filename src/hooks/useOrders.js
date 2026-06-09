// ============================================
// FILE: hooks/useOrders.js
// Added mounted guard to prevent stale setState.
// ============================================

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"
import { withTimeout } from "../lib/query"

const PAGE_SIZE = 20

export function useOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split("T")[0],
    status: "all",
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchOrders = useCallback(async (isBackground = false) => {
    try {
      console.log(
        `[useOrders] fetchOrders started. mountedRef=${mountedRef.current}`,
      )
      if (!isBackground) setLoading(true)
      setError(null)

      let query = supabase.from("orders").select(
        `
          *,
          users!inner(full_name),
          products!inner(name, volume),
          addresses!left(address_line1, city, delivery_instructions),
          subscriptions!left(frequency),
          route_stops!left(name)
        `,
        { count: "exact" },
      )

      if (filters.date) query = query.eq("delivery_date", filters.date)
      if (filters.status !== "all") query = query.eq("status", filters.status)

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const {
        data,
        error: fetchError,
        count,
      } = await withTimeout(query.range(from, to).order("created_at", { ascending: false }))

      if (fetchError) throw fetchError
      if (!mountedRef.current) {
        console.log("[useOrders] unmounted after orders fetch, aborting")
        return
      }

      const transformedData =
        data?.map((order) => ({
          id: order.id,
          orderNumber: order.order_number,
          subscriptionId: order.subscription_id,
          customerId: order.user_id,
          customerName: order.users?.full_name || "Unknown",
          city: order.addresses?.city || "—",
          addressLine: order.addresses?.address_line1 || null,
          deliveryInstructions: order.addresses?.delivery_instructions || null,
          productName: order.products?.name || "Unknown",
          productUnit: order.products?.volume || "",
          quantity: order.quantity || 1,
          originalQuantity: order.original_quantity,
          manuallyEdited: order.manually_edited || false,
          amount: order.amount || 0,
          status: order.status || "scheduled",
          date: order.delivery_date,
          failReason: order.failure_reason,
          cancellationReason: order.cancellation_reason,
          riderId: order.rider_id,
          routeStopId: order.route_stop_id,
          stopName: order.route_stops?.name || "—",
          deliveredAt: order.delivered_at,
          deliveryNotes: order.delivery_notes,
          deliveryPhotoUrl: order.delivery_photo_url || null,
          bottlePhotoUrl: order.bottle_photo_url || null,
          bottlesCollected: order.bottles_collected || 0,
          discountAmount: order.discount_amount || 0,
        })) || []

      setOrders(transformedData)
      setTotalCount(count || 0)
      console.log("[useOrders] fetchOrders transformed data successfully")
    } catch (err) {
      console.error("[useOrders] Error fetching orders:", err)
      if (mountedRef.current) setError(err.message)
    } finally {
      console.log(`[useOrders] finally block. mountedRef=${mountedRef.current}`)
      if (mountedRef.current) {
        console.log("[useOrders] Setting loading: false")
        setLoading(false)
      }
    }
  }, [page, filters])

  useEffect(() => {
    console.log("[useOrders] initial useEffect triggering fetchOrders")
    fetchOrders()
  }, [fetchOrders])

  const updateOrderStatus = useCallback(
    async (id, newStatus, additionalData = {}) => {
      try {
        if (newStatus === "delivered") {
          // Use the same RPC as the rider app — atomically marks delivered + deducts wallet
          const { data, error: rpcError } = await supabase.rpc("rpc_mark_order_delivered", {
            p_order_id: id,
            p_bottles_collected: additionalData.bottles_collected ?? 0,
          })
          if (rpcError) throw rpcError
          if (!data?.success) throw new Error("RPC rpc_mark_order_delivered returned failure")
        } else {
          const updateData = { status: newStatus, ...additionalData }
          const { error } = await supabase
            .from("orders")
            .update(updateData)
            .eq("id", id)
          if (error) throw error
        }
        await fetchOrders()
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchOrders],
  )

  const updateOrderNotes = useCallback(
    async (id, notes) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ delivery_notes: notes })
          .eq("id", id)
        if (error) throw error
        await fetchOrders()
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchOrders],
  )

  const reassignDriver = useCallback(
    async (id, riderId) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ rider_id: riderId })
          .eq("id", id)
        if (error) throw error
        await fetchOrders()
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchOrders],
  )

  const retryOrder = useCallback(
    async (id, newFailReason) => {
      try {
        // Get tomorrow's date
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split("T")[0]

        const updateData = {
          status: "scheduled",
          delivery_date: tomorrowStr,
          failure_reason: newFailReason || null,
        }
        const { error } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", id)
        if (error) throw error
        await fetchOrders()
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchOrders],
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
    orders,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    filters,
    updateFilters,
    goToPage,
    updateOrderStatus,
    updateOrderNotes,
    reassignDriver,
    retryOrder,
    refresh: fetchOrders,
  }
}
