// ============================================
// FILE: hooks/useOrders.js
// ============================================

import { useCallback } from "react"
import { supabase } from "../lib/supabase"
import { throwFunctionError } from "../lib/function-errors"
import { usePaginatedQuery } from "./usePaginatedQuery"
import { orLiteral, resolveUserIdsMatching } from "../lib/postgrest"

const SELECT = `
  *,
  users!inner(full_name),
  products!inner(name, volume),
  addresses!left(address_line1, city, delivery_instructions),
  subscriptions!left(frequency),
  route_stops!left(name)
`

export function useOrders() {
  // Search used to run in JS over the current page, so it only ever looked at
  // 20 of the day's orders. It has to be a server filter to mean anything.
  //
  // order_number lives on `orders`, but the customer's name lives on the
  // EMBEDDED users row — and PostgREST can't OR a parent column against an
  // embedded one in a single logic tree (it rejects the whole filter). So the
  // customer half is resolved to ids first, here, and OR'd in as user_id below.
  const prepare = async (filters) => {
    const search = filters.search?.trim()
    if (!search) return null
    return { search, userIds: await resolveUserIdsMatching(search) }
  }

  const applyFilters = (query, filters, prepared) => {
    if (filters.date) query = query.eq("delivery_date", filters.date)
    if (filters.status !== "all") query = query.eq("status", filters.status)

    if (prepared) {
      const clauses = [`order_number.ilike.${orLiteral(`%${prepared.search}%`)}`]
      if (prepared.userIds.length) clauses.push(`user_id.in.(${prepared.userIds.join(",")})`)
      query = query.or(clauses.join(","))
    }
    return query
  }

  const transform = useCallback(async (data) => {
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
          routeId: order.route_id,
          routeStopId: order.route_stop_id,
          stopName: order.route_stops?.name || "—",
          deliveredAt: order.delivered_at,
          deliveryNotes: order.delivery_notes,
          deliveryPhotoUrl: order.delivery_photo_url || null,
          bottlePhotoUrl: order.bottle_photo_url || null,
          bottlesCollected: order.bottles_collected || 0,
          discountAmount: order.discount_amount || 0,
        })) || []

      const findStoredPhoto = async (folder, orderId) => {
        const { data: files } = await supabase.storage
          .from("delivery-photos")
          .list(folder, {
            limit: 10,
            search: `${orderId}_`,
            sortBy: { column: "created_at", order: "desc" },
          })

        const file = files?.find((f) => f.name.startsWith(`${orderId}_`))
        if (!file) return null

        const { data: publicUrlData } = supabase.storage
          .from("delivery-photos")
          .getPublicUrl(`${folder}/${file.name}`)

        return publicUrlData.publicUrl || null
      }

      const missingEvidenceOrders = transformedData.filter(
        (order) => order.status === "delivered" && (!order.deliveryPhotoUrl || !order.bottlePhotoUrl),
      )

      if (missingEvidenceOrders.length > 0) {
        await Promise.all(
          missingEvidenceOrders.map(async (order) => {
            const [deliveryPhotoUrl, bottlePhotoUrl] = await Promise.all([
              order.deliveryPhotoUrl ? Promise.resolve(order.deliveryPhotoUrl) : findStoredPhoto("delivery", order.id),
              order.bottlePhotoUrl ? Promise.resolve(order.bottlePhotoUrl) : findStoredPhoto("bottles", order.id),
            ])

            order.deliveryPhotoUrl = deliveryPhotoUrl
            order.bottlePhotoUrl = bottlePhotoUrl
          }),
        )
      }

      return transformedData
  }, [])

  const {
    rows: orders,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    updateFilters,
    refresh: fetchOrders,
  } = usePaginatedQuery({
    table: "orders",
    select: SELECT,
    initialFilters: {
      date: new Date().toISOString().split("T")[0],
      status: "all",
      search: "",
    },
    prepare,
    applyFilters,
    transform,
  })

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
        const { data, error } = await supabase.rpc("admin_assign_order_to_rider", {
          p_order_id: id,
          p_rider_id: riderId,
        })
        if (error) await throwFunctionError(error, data)
        if (data?.error) await throwFunctionError(null, data)
        await fetchOrders()
        return { success: true, mode: data?.mode, warning: data?.warning }
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

  // Edit or cancel a single scheduled order via rpc_edit_single_order (routed
  // through the admin-db-action edge function). newQty === 0 cancels the order
  // and refunds its reserved amount; newQty > 0 changes quantity and adjusts the
  // wallet reservation (may fail with INSUFFICIENT_FUNDS).
  const editSingleOrder = useCallback(
    async (id, customerId, newQty) => {
      try {
        const res = await supabase.functions.invoke("admin-db-action", {
          body: { action: "rpc", fn: "rpc_edit_single_order", params: { p_order_id: id, p_user_id: customerId, p_new_quantity: newQty } },
        })
        if (res.error) await throwFunctionError(res.error, res.data)
        if (res.data?.error) {
          const d = res.data.data
          if (d?.error === "INSUFFICIENT_FUNDS") {
            throw new Error(`Insufficient wallet balance. Short by ₹${Number(d.shortfall || 0).toFixed(2)}. Top up the wallet first.`)
          }
          await throwFunctionError(null, res.data)
        }
        await fetchOrders()
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
    [fetchOrders],
  )

  const autoAssignOrders = useCallback(async (date) => {
    try {
      const [orderRes, returnRes] = await Promise.all([
        supabase.rpc('assign_riders_to_orders', { p_date: date }),
        supabase.rpc('assign_riders_to_bottle_returns', { p_date: date }),
      ])
      if (orderRes.error) throw orderRes.error
      if (returnRes.error) throw returnRes.error
      await fetchOrders()
      return {
        success: true,
        ordersAssigned: orderRes.data?.updated ?? 0,
        returnsAssigned: returnRes.data?.updated ?? 0,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [fetchOrders])

  return {
    orders,
    loading,
    error,
    totalCount,
    loadingMore,
    hasMore,
    loadMore,
    filters,
    updateFilters,
    updateOrderStatus,
    updateOrderNotes,
    reassignDriver,
    retryOrder,
    editSingleOrder,
    autoAssignOrders,
    refresh: fetchOrders,
  }
}
