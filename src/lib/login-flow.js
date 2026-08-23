// ============================================
// FILE: lib/login-flow.js
// ============================================

// sendOTP/verifyOTP resolve to { success, error } instead of throwing, so a
// discarded return value is a silently swallowed failure.
export function authResultError(result, fallback) {
  if (result?.success) return null;
  return result?.error || fallback;
}
