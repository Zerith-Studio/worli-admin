// ============================================
// FILE: lib/admin-check.js
// ============================================

// Decide how an auth event should move the admin state before the async admin
// check runs. Returning setAdmin: null on sign-in (rather than leaving the
// stale value) is what lets deriveAuthLoading keep the app in "loading" while
// the check is in flight — otherwise a re-login flashes Access Denied.
//
// sameUser says the incoming session belongs to the user whose admin verdict we
// already hold. It matters because SIGNED_IN is not only a login: supabase-js
// registers a visibilitychange handler that calls _recoverAndRefresh(), and its
// healthy path notifies SIGNED_IN for the session it just read back from
// storage. So every switch to another tab and back arrives here as a sign-in.
// Blanking isAdmin for one puts App.jsx into its loading branch, which returns
// above <Router> and unmounts the whole console — losing any form in progress.
export function planAuthTransition(event, hasSession, sameUser = false) {
  if (!hasSession) return { setAdmin: false, recheck: false };
  if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    // A known user needs no loading gate; there is nothing to hide behind it.
    // USER_UPDATED still revalidates, but silently — a metadata edit must not
    // tear the tree down, and a revoked admin is caught when the check lands.
    if (sameUser) return { setAdmin: 'keep', recheck: event === 'USER_UPDATED' };
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
    // A rejected query (a timeout, or supabase-js throwing rather than
    // resolving) must land here as 'error'. Letting it propagate leaves the
    // caller's isAdmin unset, which reads as "check still in flight" forever.
    let outcome;
    try {
      outcome = interpretAdminResult(await queryFn());
    } catch {
      outcome = 'error';
    }
    if (outcome !== 'error' || attempt >= retries) return outcome;
    await sleep(delayMs);
  }
}
