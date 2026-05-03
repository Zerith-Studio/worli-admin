// ============================================
// FILE: hooks/useBadgeCounts.js
// Fetches real badge counts for nav items
// ============================================

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useBadgeCounts() {
  const [failedOrdersToday, setFailedOrdersToday] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('delivery_date', today)
          .eq('status', 'failed');
        if (mountedRef.current) setFailedOrdersToday(count || 0);
      } catch (err) {
        console.error('Error fetching badge counts:', err);
      }
    };
    fetch();

    const interval = setInterval(() => {
      if (mountedRef.current) fetch();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return { failedOrdersToday };
}
