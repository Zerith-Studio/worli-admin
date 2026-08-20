// ============================================
// FILE: lib/admin-check.js
// ============================================

// Decide how an auth event should move the admin state before the async admin
// check runs. Returning setAdmin: null on sign-in (rather than leaving the
// stale value) is what lets deriveAuthLoading keep the app in "loading" while
// the check is in flight — otherwise a re-login flashes Access Denied.
export function planAuthTransition(event, hasSession) {
  if (!hasSession) return { setAdmin: false, recheck: false };
  if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    return { setAdmin: null, recheck: true };
  }
  return { setAdmin: 'keep', recheck: false };
}

// supabase-js resolves a failed query as { data: null, error } rather than
// throwing, so an absent row and a failed lookup both arrive as data: null.
// Distinguishing them keeps a transient error from reading as "not an admin".
export function interpretAdminResult({ data, error }) {
  if (error) return 'error';
  return data ? 'admin' : 'not-admin';
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run the admin lookup, retrying only on error (a real denial resolves
// immediately). After exhausting retries a persistent error stays 'error', so
// the caller can fail closed without permanently locking out an admin who hit
// a blip.
export async function checkAdminWithRetry(queryFn, { retries = 2, delayMs = 300, sleep = defaultSleep } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const outcome = interpretAdminResult(await queryFn());
    if (outcome !== 'error' || attempt >= retries) return outcome;
    await sleep(delayMs);
  }
}
