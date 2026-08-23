// ============================================
// FILE: utils/formatters.js
// Utility functions for formatting
// ============================================

// en-CA formats as YYYY-MM-DD. IST calendar date, because
// new Date().toISOString() returns the UTC date, which lags IST by a day
// between 00:00 and 05:30 IST — the delivery window.
const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

export function istDate(offsetDays = 0, now = new Date()) {
  return IST_DATE.format(new Date(now.getTime() + offsetDays * 86400000));
}

export function istToday(now = new Date()) {
  return istDate(0, now);
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const dt = new Date(dateStr);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(timeStr) {
  if (!timeStr) return "—";
  const dt = new Date(timeStr);
  return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const dt = new Date(dateStr);
  return dt.toLocaleString("en-IN", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return "—";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export function formatPhone(phone) {
  if (!phone) return "—";
  // Format as +91 XXXXX XXXXX
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

export function truncate(str, length = 50) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
}
