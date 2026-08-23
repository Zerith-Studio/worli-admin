// ============================================
// FILE: lib/wallet-threshold.js
// ============================================

// app_settings values are free-form text. A non-numeric one (e.g. "₹200")
// parseFloats to NaN; passed on as a wallet threshold it becomes a
// .lt('balance', NaN) query that PostgREST rejects, erroring the whole
// dashboard and rendering "below ₹NaN". Fall back to the default instead.
export function parseThreshold(raw, fallback) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
