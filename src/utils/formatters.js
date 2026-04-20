// ============================================
// FILE: utils/formatters.js
// Utility functions for formatting
// ============================================

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
