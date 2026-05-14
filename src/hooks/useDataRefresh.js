// ============================================
// FILE: hooks/useDataRefresh.js
// Simple polling hook. Calls refreshFn on an interval
// only when the tab is visible. Clean and minimal.
// ============================================

import { useEffect, useRef } from 'react';

export function useDataRefresh(refreshFn, interval = 60000) {
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn; // always call latest version

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fnRef.current(true); // true = background refresh (no loading spinner)
      }
    }, interval);
    return () => clearInterval(id);
  }, [interval]);
}
