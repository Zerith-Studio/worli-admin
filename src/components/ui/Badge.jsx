// ============================================
// FILE: components/ui/Badge.jsx
// ============================================

import React from 'react';

const VARIANTS = {
  green: 'badge-green',
  yellow: 'badge-yellow',
  red: 'badge-red',
  blue: 'badge-blue',
  gray: 'badge-gray',
  teal: 'badge-teal',
};

export function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`badge ${VARIANTS[variant] || VARIANTS.gray} ${className}`}>
      {children}
    </span>
  );
}
