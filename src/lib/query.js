// ============================================
// FILE: lib/query.js
// Wraps every Supabase query with a 12-second timeout.
// If the gotrue lock ever stalls despite the bypass, this
// ensures loading states always resolve instead of hanging.
// ============================================

export async function withTimeout(promise, ms = 12000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Query timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
