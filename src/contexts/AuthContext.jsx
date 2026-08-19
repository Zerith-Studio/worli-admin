// ============================================
// FILE: contexts/AuthContext.jsx
// Clean, simple auth context.
// Pattern: getSession() once on mount → done.
// onAuthStateChange handles subsequent events only.
// No complex ref races, no DB queries in the listener.
// ============================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { deriveAuthLoading } from '../lib/auth-state';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still loading
  // null      = loaded, not authenticated
  // object    = loaded, authenticated session
  const [session, setSession] = useState(undefined);
  // null = admin check not yet resolved for the current session
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    // 1. Get the current session synchronously from localStorage.
    //    This is instant — no network call.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
      if (s?.user) checkAdmin(s.user.id);
    });

    // 2. Listen for future auth changes (sign in, sign out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        console.log('[Auth] event:', event);
        setSession(s ?? null);
        if (s?.user) {
          // Only re-check admin on actual sign-in, not silent token refresh.
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            checkAdmin(s.user.id);
          }
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId) {
    try {
      const { data } = await supabase
        .from('admins')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  }

  async function sendOTP(phone) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async function verifyOTP(phone, token) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone, token, type: 'sms',
    });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: 'Login failed' };

    const { data: adminRow } = await supabase
      .from('admins')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!adminRow) {
      await supabase.auth.signOut();
      return { success: false, error: 'Access denied. You are not an admin.' };
    }

    setIsAdmin(true);
    return { success: true };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const loading = deriveAuthLoading(session, isAdmin);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isAdmin,
      loading,
      sendOTP,
      verifyOTP,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
