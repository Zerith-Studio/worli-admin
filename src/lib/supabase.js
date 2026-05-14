// ============================================
// FILE: lib/supabase.js
// Admin Dashboard Supabase Client
// Lock bypass prevents gotrue from hanging queries
// during silent token refresh (the infinite spinner bug).
// ============================================

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key must be defined in .env file")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Bypass the Web Locks API. This prevents the gotrue client from
    // deadlocking concurrent requests during a silent token refresh,
    // which is the root cause of the "infinite spinner after inactivity" bug.
    lock: (name, acquireTimeout, fn) => fn(),
  },
})
