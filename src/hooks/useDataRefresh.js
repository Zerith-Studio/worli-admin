// ============================================
// FILE: hooks/useDataRefresh.js
// Simple polling hook. Calls refreshFn on an interval
// only when the tab is visible and nobody is mid-interaction.
// ============================================

import { useEffect, useRef } from 'react';
import { shouldBackgroundRefresh, readRefreshContext } from '../lib/refresh-gate';

export function useDataRefresh(refreshFn, interval = 60000) {
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn; // always call latest version

  useEffect(() => {
    const id = setInterval(() => {
      const ctx = readRefreshContext(document, () => window.getSelection?.());
      if (shouldBackgroundRefresh(ctx)) {
        fnRef.current(true); // true = background refresh (no loading spinner)
      }
    }, interval);
    return () => clearInterval(id);
  }, [interval]);
}
