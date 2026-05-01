// ============================================
// FILE: lib/supabase.js
// Admin Dashboard Supabase Client
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
  },
})

// Helper to check if user is admin
export const isAdmin = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .single()

  return !!data && !error
}

// RPC helper for admin check (uses the is_admin() function in DB)
export const checkIsAdminRPC = async () => {
  console.log("[Supabase] checkIsAdminRPC called")
  try {
    const { data, error } = await supabase.rpc("is_admin")
    console.log("[Supabase] checkIsAdminRPC result:", { data, error })
    if (error) {
      console.error("[Supabase] checkIsAdminRPC error:", error)
      return false
    }
    return !!data
  } catch (err) {
    console.error("[Supabase] checkIsAdminRPC exception:", err)
    return false
  }
}
