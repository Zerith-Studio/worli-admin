// ============================================
// FILE: hooks/useCustomers.js
// ============================================

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"
import { withTimeout } from "../lib/query"

const PAGE_SIZE = 12

export function useCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [minWalletBalance, setMinWalletBalance] = useState(100)
  const [filters, setFilters] = useState({ search: "", status: "all" })
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchCustomers = useCallback(async (isBackground = false) => {
    try {
      console.log(
        `[useCustomers] fetchCustomers started. mountedRef=${mountedRef.current}`,
      )
      if (!isBackground) setLoading(true)
      setError(null)

      // Fetch dynamic low-balance threshold
      const { data: settingData } = await withTimeout(
        supabase.from("app_settings").select("setting_value").eq("setting_key", "min_wallet_balance").maybeSingle()
      )
      const threshold = parseFloat(settingData?.setting_value || "100")
      if (mountedRef.current) setMinWalletBalance(threshold)

      let query = supabase.from("users").select(
        `
          id, full_name, phone_number, email, bottles_pending, created_at,
          wallets(balance),
          addresses(city, is_default),
          subscriptions!left(id, status)
        `,
        { count: "exact" },
      )

      if (filters.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`,
        )
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const {
        data,
        error: fetchError,
        count,
      } = await withTimeout(query.range(from, to).order("created_at", { ascending: false }))

      if (fetchError) throw fetchError
      if (!mountedRef.current) {
        console.log("[useCustomers] unmounted after users fetch, aborting")
        return
      }

      const transformedData =
        data?.map((user) => {
          // wallets is a 1-1 relation but PostgREST may return array or object
          const walletRaw = user.wallets
          const wallet = Array.isArray(walletRaw) ? walletRaw[0] : walletRaw
          const balance = wallet?.balance ?? 0

          const defaultAddress =
            user.addresses?.find((a) => a.is_default) || user.addresses?.[0]
          const activeSubs =
            user.subscriptions?.filter((s) => s.status === "active") || []

          let status = "active"
          if (balance < 0) status = "inactive"
          else if (balance < threshold) status = "at_risk"

          return {
            id: user.id,
            name: user.full_name || "Unnamed",
            phone: user.phone_number,
            email: user.email,
            city: defaultAddress?.city || "—",
            wallet: balance,
            bottles_pending: user.bottles_pending || 0,
            status,
            joined: user.created_at?.split("T")[0],
            totalOrders: user.subscriptions?.length || 0,
            activeSubscriptions: activeSubs.length,
          }
        }) || []

      let filteredData = transformedData
      if (filters.status !== "all") {
        filteredData = transformedData.filter(
          (c) => c.status === filters.status,
        )
      }

      setCustomers(filteredData)
      setTotalCount(count || 0)
      console.log("[useCustomers] fetchCustomers transformed data successfully")
    } catch (err) {
      console.error("[useCustomers] Error fetching customers:", err)
      if (mountedRef.current) setError(err.message)
    } finally {
      console.log(
        `[useCustomers] finally block. mountedRef=${mountedRef.current}`,
      )
      if (mountedRef.current) {
        console.log("[useCustomers] Setting loading: false")
        setLoading(false)
      }
    }
  }, [page, filters])

  useEffect(() => {
    console.log("[useCustomers] initial useEffect triggering fetchCustomers")
    fetchCustomers()
  }, [fetchCustomers])

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPage(1)
  }, [])

  const goToPage = useCallback((newPage) => {
    setPage(newPage)
  }, [])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    customers,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    filters,
    minWalletBalance,
    updateFilters,
    goToPage,
    refresh: fetchCustomers,
  }
}
