// ============================================
// FILE: hooks/useDashboardStats.js
// Hook for fetching dashboard statistics
// ============================================

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"

const TODAY = new Date().toISOString().split("T")[0]

export function useDashboardStats() {
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeSubscriptions: 0,
    todayOrders: 0,
    todayDelivered: 0,
    todayFailed: 0,
    todayPending: 0,
    todayRevenue: 0,
    atRiskCustomers: 0,
    pausedCustomers: 0,
    lowBalanceCount: 0,
    deliveryPct: 0,
    zoneStats: [],
    weekData: [],
    loading: true,
    error: null,
  })

  const fetchStats = useCallback(async () => {
    try {
      console.log(
        "[useDashboardStats] fetchStats started. Setting loading: true",
      )
      setStats((prev) => ({ ...prev, loading: true, error: null }))

      // Fetch total customers
      const { count: totalCustomers, error: customersError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })

      if (customersError) throw customersError

      // Fetch active subscriptions
      const { count: activeSubscriptions, error: subsError } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      if (subsError) throw subsError

      // Fetch today's orders
      const { data: todayOrdersData, error: ordersError } = await supabase
        .from("orders")
        .select("status, amount")
        .eq("delivery_date", TODAY)

      if (ordersError) throw ordersError

      const todayOrders = todayOrdersData || []
      const todayDelivered = todayOrders.filter(
        (o) => o.status === "delivered",
      ).length
      const todayFailed = todayOrders.filter(
        (o) => o.status === "failed",
      ).length
      const todayPending = todayOrders.filter((o) =>
        ["pending", "in_transit", "scheduled"].includes(o.status),
      ).length
      const todayRevenue = todayOrders
        .filter((o) => o.status === "delivered")
        .reduce((sum, o) => sum + (o.amount || 0), 0)

      const deliveryPct = todayOrders.length
        ? Math.round((todayDelivered / todayOrders.length) * 100)
        : 0

      // Fetch customers with low/negative balance
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("balance")

      if (walletError) throw walletError

      const lowBalanceCount =
        walletData?.filter((w) => (w.balance || 0) < 0).length || 0
      const atRiskCustomers =
        walletData?.filter(
          (w) => (w.balance || 0) >= 0 && (w.balance || 0) < 200,
        ).length || 0

      // Fetch paused customers
      const { count: pausedCustomers, error: pausedError } = await supabase
        .from("subscriptions")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "paused")

      if (pausedError) throw pausedError

      // Fetch zone stats (requires orders joined with addresses)
      const { data: zoneOrdersData, error: zoneError } = await supabase
        .from("orders")
        .select(
          `
          status,
          addresses!inner (
            city
          )
        `,
        )
        .eq("delivery_date", TODAY)

      if (zoneError) throw zoneError

      // Group by city/zone
      const zoneMap = {}
      zoneOrdersData?.forEach((order) => {
        const zone = order.addresses?.city || "Unknown"
        if (!zoneMap[zone]) {
          zoneMap[zone] = { total: 0, done: 0 }
        }
        zoneMap[zone].total += 1
        if (order.status === "delivered") {
          zoneMap[zone].done += 1
        }
      })

      const zoneStats = Object.entries(zoneMap).map(([zone, stats]) => ({
        zone,
        total: stats.total,
        done: stats.done,
      }))

      // Fetch week data (last 7 days delivered orders)
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split("T")[0]
      })

      const { data: weekOrders, error: weekError } = await supabase
        .from("orders")
        .select("delivery_date")
        .eq("status", "delivered")
        .gte("delivery_date", weekDates[0])
        .lte("delivery_date", weekDates[6])

      if (weekError) throw weekError

      const weekMap = {}
      weekDates.forEach((d) => (weekMap[d] = 0))
      weekOrders?.forEach((o) => {
        if (weekMap[o.delivery_date] !== undefined) {
          weekMap[o.delivery_date] += 1
        }
      })

      const weekData = weekDates.map((d) => weekMap[d])

      if (!mountedRef.current) return

      setStats({
        totalCustomers: totalCustomers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        todayOrders: todayOrders.length,
        todayDelivered,
        todayFailed,
        todayPending,
        todayRevenue,
        atRiskCustomers,
        pausedCustomers: pausedCustomers || 0,
        lowBalanceCount,
        deliveryPct,
        zoneStats,
        weekData,
        loading: false,
        error: null,
      })
      console.log(
        "[useDashboardStats] fetchStats succeeded. Setting loading: false",
      )
    } catch (err) {
      console.error("[useDashboardStats] Error fetching dashboard stats:", err)
      if (mountedRef.current) {
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        }))
      }
    }
  }, [])

  useEffect(() => {
    console.log("[useDashboardStats] initial useEffect triggering fetchStats")
    fetchStats()
  }, [fetchStats])

  return { ...stats, refresh: fetchStats }
}
