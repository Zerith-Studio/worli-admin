// ============================================
// FILE: hooks/useDataRefresh.js
// Fixed: removed double-fire (hooks own their initial load),
// added mounted guard so stale intervals don't trigger state
// updates on unmounted components.
// ============================================

import { useEffect, useRef } from "react"
import { REFRESH_INTERVAL } from "../constants"

export function useDataRefresh(
  refreshFn,
  interval = REFRESH_INTERVAL,
  enabled = true,
) {
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      console.log(`[useDataRefresh] not enabled`)
      return
    }

    console.log(`[useDataRefresh] setting up setInterval for ${interval}ms`)
    const id = setInterval(() => {
      console.log(
        `[useDataRefresh] interval tick. mountedRef=${mountedRef.current}`,
      )
      if (mountedRef.current && document.visibilityState === "visible") {
        refreshFn(true)
      }
    }, interval)

    return () => {
      console.log(`[useDataRefresh] clearing interval`)
      clearInterval(id)
    }
  }, [refreshFn, interval, enabled])

  return { refresh: refreshFn }
}
