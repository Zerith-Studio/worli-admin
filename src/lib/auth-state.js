// ============================================
// FILE: lib/auth-state.js
// ============================================

// Auth is loading until BOTH the session and, when a session exists, the
// admin check have resolved. isAdmin === null means the check is still in
// flight — treating it as "not admin" flashed Access Denied on every reload.
export function deriveAuthLoading(session, isAdmin) {
  if (session === undefined) return true;
  return !!session?.user && isAdmin === null;
}
