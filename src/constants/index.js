// ============================================
// FILE: constants/index.js
// Constants for Admin Dashboard
// ============================================

// Navigation items grouped by category
export const NAV_ITEMS = [
  { key: "dashboard", icon: "◈", label: "Dashboard", group: "main" },
  { key: "customers", icon: "👥", label: "Customers", group: "customers" },
  { key: "subscriptions", icon: "📋", label: "Subscriptions", group: "customers" },
  { key: "orders", icon: "📦", label: "Orders", group: "orders" },
  { key: "schedule", icon: "📅", label: "Delivery Schedule", group: "orders" },
  { key: "inventory", icon: "🧮", label: "Inventory", group: "products" },
  { key: "forecast", icon: "📈", label: "Demand Forecast", group: "products" },
  { key: "routes", icon: "🗺", label: "Routes", group: "delivery" },
  { key: "drivers", icon: "🚗", label: "Drivers", group: "delivery" },
  { key: "wallet", icon: "💳", label: "Wallet", group: "payments" },
  { key: "assets", icon: "🍶", label: "Asset Tracking", group: "assets" },
  { key: "settings", icon: "⚙", label: "Settings", group: "system" },
];

export const GROUP_LABELS = {
  main: null,
  customers: "Customers",
  orders: "Operations",
  products: "Products",
  delivery: "Delivery",
  payments: "Finance",
  assets: "Assets",
  system: "System",
};

export const PAGE_TITLES = {
  dashboard: "Dashboard",
  customers: "Customers",
  subscriptions: "Subscriptions",
  orders: "Orders",
  schedule: "Delivery Schedule",
  inventory: "Inventory",
  forecast: "Demand Forecast",
  routes: "Routes",
  drivers: "Drivers",
  wallet: "Wallet",
  assets: "Asset Tracking",
  settings: "Settings",
};

// Order statuses
export const ORDER_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Failure reasons for orders
export const FAIL_REASONS = [
  "Customer absent",
  "Gate locked",
  "Address not found",
  "Refused delivery",
  "Milk quality issue",
  "Other",
];

// Subscription types
export const SUBSCRIPTION_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'custom', label: 'Custom' },
  { value: 'on_interval', label: 'On Interval' },
];

// Subscription statuses
export const SUBSCRIPTION_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

// Rider statuses
export const RIDER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
];

// Table pagination
export const DEFAULT_PAGE_SIZE = 12;

// Refresh intervals (in milliseconds)
export const REFRESH_INTERVAL = 60000; // 1 minute
