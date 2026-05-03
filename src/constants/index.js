// ============================================
// FILE: constants/index.js
// Added buy_once to SUBSCRIPTION_TYPES, on_hold to ORDER_STATUSES,
// hubs nav item under delivery group.
// ============================================

export const NAV_ITEMS = [
  { key: 'dashboard', icon: '◈', label: 'Dashboard', group: 'main' },
  { key: 'customers', icon: '👥', label: 'Customers', group: 'customers' },
  { key: 'subscriptions', icon: '📋', label: 'Subscriptions', group: 'customers' },
  { key: 'orders', icon: '📦', label: 'Orders', group: 'orders' },
  { key: 'schedule', icon: '📅', label: 'Delivery Schedule', group: 'orders' },
  { key: 'forecast', icon: '📈', label: 'Demand Forecast', group: 'products' },
  { key: 'hubs', icon: '🏭', label: 'Hubs', group: 'delivery' },
  { key: 'routes', icon: '🗺', label: 'Routes', group: 'delivery' },
  { key: 'drivers', icon: '🚗', label: 'Drivers', group: 'delivery' },
  { key: 'wallet', icon: '💳', label: 'Wallet', group: 'payments' },
  { key: 'assets', icon: '🍶', label: 'Asset Tracking', group: 'assets' },
  { key: 'settings', icon: '⚙', label: 'Settings', group: 'system' },
];

export const GROUP_LABELS = {
  main: null,
  customers: 'Customers',
  orders: 'Operations',
  products: 'Products',
  delivery: 'Delivery',
  payments: 'Finance',
  assets: 'Assets',
  system: 'System',
};

export const PAGE_TITLES = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  subscriptions: 'Subscriptions',
  orders: 'Orders',
  schedule: 'Delivery Schedule',
  forecast: 'Demand Forecast',
  hubs: 'Hubs',
  routes: 'Routes',
  drivers: 'Drivers',
  wallet: 'Wallet',
  assets: 'Asset Tracking',
  settings: 'Settings',
};

// Order statuses — matches DB CHECK constraint
export const ORDER_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const FAIL_REASONS = [
  'Customer absent',
  'Gate locked',
  'Address not found',
  'Refused delivery',
  'Milk quality issue',
  'Other',
];

// Subscription types — matches DB CHECK constraint on frequency
export const SUBSCRIPTION_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'custom', label: 'Custom Days' },
  { value: 'on_interval', label: 'On Interval' },
  { value: 'buy_once', label: 'Buy Once' },
];

// Subscription statuses — matches DB CHECK constraint
export const SUBSCRIPTION_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

// Rider statuses — matches DB DEFAULT & usage
export const RIDER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
];

export const DEFAULT_PAGE_SIZE = 12;
export const REFRESH_INTERVAL = 60000;
