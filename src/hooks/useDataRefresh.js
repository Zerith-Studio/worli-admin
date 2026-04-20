// ============================================
// FILE: hooks/useDataRefresh.js
// Hook for auto-refreshing data at intervals
// ============================================

import { useEffect, useRef } from 'react';
import { REFRESH_INTERVAL } from '../constants';

export function useDataRefresh(refreshFn, interval = REFRESH_INTERVAL, enabled = true) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // Initial refresh
    refreshFn();

    // Set up interval
    intervalRef.current = setInterval(() => {
      refreshFn();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshFn, interval, enabled]);

  return { refresh: refreshFn };
}
