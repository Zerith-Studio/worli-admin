// ============================================
// FILE: contexts/AuthContext.jsx
// Authentication Context for Admin Dashboard
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track whether the initial session check has completed.
  // The onAuthStateChange listener fires an INITIAL_SESSION event at the same
  // time as initSession runs, causing both to query the admins table in
  // parallel and race to set loading=false. This ref prevents that.
  const initDone = useRef(false);

  // Check admin status
  const checkAdminStatus = useCallback(async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return false;
    }

    try {
      console.log('[AuthContext] querying admins table for id:', userId);
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      console.log('[AuthContext] admins query result:', { data, error });
      const isAdminUser = !!data && !error;
      setIsAdmin(isAdminUser);
      return isAdminUser;
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
      return false;
    }
  }, []);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      console.log('[AuthContext] initSession called');
      try {
        console.log('[AuthContext] getting session from supabase');
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        console.log('[AuthContext] getSession result:', { sessionFound: !!currentSession, error: sessionError });

        if (sessionError) {
          throw sessionError;
        }

        if (currentSession) {
          console.log('[AuthContext] Setting session to state');
          setSession(currentSession);
          setUser(currentSession.user);
          console.log('[AuthContext] Checking admin status for user:', currentSession.user?.id);
          const isAdm = await checkAdminStatus(currentSession.user?.id);
          console.log('[AuthContext] Admin check done:', isAdm);
        } else {
          console.log('[AuthContext] No current session found.');
        }
      } catch (err) {
        console.error('[AuthContext] Session init error:', err);
        setError(err.message);
      } finally {
        console.log('[AuthContext] initSession completed. setting loading false');
        initDone.current = true;
        setLoading(false);
      }
    };

    initSession();

    // Subscribe to auth changes.
    // We skip processing the very first event if initSession has not yet
    // finished — Supabase always fires INITIAL_SESSION synchronously, which
    // would race with initSession and double-query the admins table.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // Let initSession own the startup flow; only handle subsequent events.
      if (!initDone.current) {
        return;
      }

      if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession.user);
      await checkAdminStatus(newSession.user?.id);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  // Send OTP to phone
  const sendOTP = async (phone) => {
    try {
      setError(null);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone
      });

      if (otpError) {
        throw otpError;
      }

      return { success: true };
    } catch (err) {
      console.error('Send OTP error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Verify OTP and login
  const verifyOTP = async (phone, token) => {
    try {
      setError(null);
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms'
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data.user) {
        // Check if user is admin
        const isAdminUser = await checkAdminStatus(data.user.id);

        if (!isAdminUser) {
          // Not an admin, sign out
          await supabase.auth.signOut();
          setError('Access denied. You are not authorized as an admin.');
          return { success: false, error: 'Access denied. You are not authorized as an admin.' };
        }

        setSession(data.session);
        setUser(data.user);
        setIsAdmin(true);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message);
    }
  };

  const value = {
    session,
    user,
    isAdmin,
    loading,
    error,
    sendOTP,
    verifyOTP,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
