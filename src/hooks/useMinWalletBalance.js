// ============================================
// FILE: hooks/useMinWalletBalance.js
// ============================================

import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { withTimeout } from "../lib/query"
import { parseThreshold } from "../lib/wallet-threshold"

/** Fallback if app_settings hasn't been seeded. Matches the previous inline default. */
const DEFAULT_THRESHOLD = 100

/**
 * The wallet balance below which a customer counts as "at risk".
 *
 * Lives in app_settings so ops can tune it. Both the customers list and the
 * wallet page derive their status/risk buckets from it, and both used to fetch
 * it inline — meaning the two pages could disagree about who was at risk if the
 * setting changed between their loads.
 *
 * Returns `null` until loaded, so callers can hold off on a query that would
 * otherwise bucket everyone against the wrong number for one render.
 */
export function useMinWalletBalance() {
  const [threshold, setThreshold] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await withTimeout(
          supabase
            .from("app_settings")
            .select("setting_value")
            .eq("setting_key", "min_wallet_balance")
            .maybeSingle()
        )
        if (!cancelled) setThreshold(parseThreshold(data?.setting_value, DEFAULT_THRESHOLD))
      } catch {
        // Fail open on the default rather than leaving the list unloadable.
        if (!cancelled) setThreshold(DEFAULT_THRESHOLD)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return threshold
}
