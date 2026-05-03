// ============================================
// FILE: hooks/useDataRefresh.js
// Fixed: removed double-fire (hooks own their initial load),
// added mounted guard so stale intervals don't trigger state
// updates on unmounted components.
// ============================================

import { useEffect, useRef } from 'react';
import { REFRESH_INTERVAL } from '../constants';

export function useDataRefresh(refreshFn, interval = REFRESH_INTERVAL, enabled = true) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // NOTE: No initial refreshFn() call here — each data hook has its own
    // useEffect that handles the initial fetch. Calling it here too caused
    // duplicate in-flight requests and loading-state races on navigation.
    const id = setInterval(() => {
      if (mountedRef.current) refreshFn();
    }, interval);

    return () => clearInterval(id);
  }, [refreshFn, interval, enabled]);

  return { refresh: refreshFn };
}
