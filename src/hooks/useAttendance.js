// ============================================
// FILE: hooks/useAttendance.js
// Fetch daily rider attendance and delivery stats
// ============================================

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"

export function useAttendance(date) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchAttendance = useCallback(async () => {
    if (!date) return
    try {
      setLoading(true)
      setError(null)

      // Fetch all riders
      const { data: ridersData, error: ridersError } = await supabase
        .from("riders")
        .select("id, status")
      if (ridersError) throw ridersError

      const riderIds = ridersData?.map((r) => r.id) || []
      if (riderIds.length === 0) {
        if (mountedRef.current) {
          setAttendance([])
          setLoading(false)
        }
        return
      }

      // Fetch users (name, phone)
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, phone_number")
        .in("id", riderIds)
      if (usersError) throw usersError

      const usersMap = {}
      usersData?.forEach((u) => {
        usersMap[u.id] = u
      })

      // Fetch attendance for the specific date
      const { data: attendanceData, error: attError } = await supabase
        .from("rider_attendance")
        .select("rider_id, checked_in_at")
        .eq("date", date)
        .in("rider_id", riderIds)
      if (attError) throw attError

      const attendanceMap = {}
      attendanceData?.forEach((a) => {
        attendanceMap[a.rider_id] = a.checked_in_at
      })

      // Fetch orders for the specific date
      const { data: ordersData, error: ordError } = await supabase
        .from("orders")
        .select("id, rider_id, status, addresses(delivery_instructions)")
        .eq("delivery_date", date)
        .not("rider_id", "is", null)
      if (ordError) throw ordError

      const ordersMap = {}
      riderIds.forEach((id) => {
        ordersMap[id] = { total: 0, completed: 0, failed: 0, pending: 0, orders: [] }
      })

      ordersData?.forEach((o) => {
        if (!ordersMap[o.rider_id]) return
        ordersMap[o.rider_id].total++
        if (o.status === "delivered") ordersMap[o.rider_id].completed++
        else if (o.status === "failed") ordersMap[o.rider_id].failed++
        else ordersMap[o.rider_id].pending++
        
        ordersMap[o.rider_id].orders.push(o)
      })

      if (!mountedRef.current) return

      const transformed = ridersData.map((r) => {
        const stats = ordersMap[r.id]
        let progress = 0
        if (stats.total > 0) {
          progress = Math.round(((stats.completed + stats.failed) / stats.total) * 100)
        }
        return {
          id: r.id,
          name: usersMap[r.id]?.full_name || "Unnamed Rider",
          phone: usersMap[r.id]?.phone_number || "—",
          riderStatus: r.status,
          isPresent: !!attendanceMap[r.id],
          checkedInAt: attendanceMap[r.id] || null,
          stats,
          progress,
        }
      })

      // Sort: present first, then alphabetically
      transformed.sort((a, b) => {
        if (a.isPresent && !b.isPresent) return -1
        if (!a.isPresent && b.isPresent) return 1
        return a.name.localeCompare(b.name)
      })

      setAttendance(transformed)
    } catch (err) {
      if (mountedRef.current) setError(err.message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  return { attendance, loading, error, refresh: fetchAttendance }
}
