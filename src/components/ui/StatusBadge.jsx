// ============================================
// FILE: components/ui/StatusBadge.jsx
// ============================================

import React from 'react';
import { Badge } from './Badge';

const STATUS_MAP = {
  // Generic statuses
  active: { variant: 'green', label: 'Active' },
  paused: { variant: 'gray', label: 'Paused' },
  cancelled: { variant: 'red', label: 'Cancelled' },
  completed: { variant: 'green', label: 'Completed' },
  
  // Order statuses
  delivered: { variant: 'green', label: 'Delivered' },
  failed: { variant: 'red', label: 'Failed' },
  pending: { variant: 'blue', label: 'Pending' },
  in_transit: { variant: 'teal', label: 'In Transit' },
  scheduled: { variant: 'blue', label: 'Scheduled' },
  
  // Subscription types
  daily: { variant: 'blue', label: 'Daily' },
  alternate: { variant: 'teal', label: 'Alternate' },
  custom: { variant: 'gray', label: 'Custom' },
  on_interval: { variant: 'blue', label: 'On Interval' },
  buy_once: { variant: 'gray', label: 'Buy Once' },
  
  // Customer statuses
  at_risk: { variant: 'yellow', label: 'At Risk' },
  
  // Route/Driver statuses
  in_progress: { variant: 'blue', label: 'In Progress' },
  on_leave: { variant: 'yellow', label: 'On Leave' },
  inactive: { variant: 'gray', label: 'Inactive' },
};

export function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { variant: 'gray', label: status };
  return (
    <Badge variant={config.variant}>
      {config.label || status?.charAt(0).toUpperCase() + status?.slice(1)}
    </Badge>
  );
}
