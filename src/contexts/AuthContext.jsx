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
import { withTimeout } from '../lib/query';
import { planAuthTransition, checkAdminWithRetry } from '../lib/admin-check';

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
        // Reset isAdmin to null before a re-check so the loading guard covers
        // the in-flight check; a silent token refresh leaves it untouched.
        const { setAdmin, recheck } = planAuthTransition(event, !!s?.user);
        if (setAdmin !== 'keep') setIsAdmin(setAdmin);
        if (recheck) checkAdmin(s.user.id);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId) {
    // Fail closed only after retries: a transient lookup failure must not lock
    // a real admin out of the console. withTimeout is what guarantees this
    // settles at all — isAdmin gates the loading state, so a stalled query
    // would otherwise hold the app on the loading screen with no way out.
    const outcome = await checkAdminWithRetry(() =>
      withTimeout(supabase.from('admins').select('id').eq('id', userId).maybeSingle())
    );
    if (outcome === 'error') {
      console.error('[Auth] admin check failed after retries; denying');
    }
    setIsAdmin(outcome === 'admin');
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

    // Same lookup as checkAdmin, and it needs the same treatment: a failed
    // query resolves as data: null, which read as a denial and signed a real
    // admin out on a blip.
    const outcome = await checkAdminWithRetry(() =>
      withTimeout(supabase.from('admins').select('id').eq('id', data.user.id).maybeSingle())
    );

    if (outcome !== 'admin') {
      await supabase.auth.signOut();
      return {
        success: false,
        error: outcome === 'error'
          ? 'Could not verify your account. Please try again.'
          : 'Access denied. You are not an admin.',
      };
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
