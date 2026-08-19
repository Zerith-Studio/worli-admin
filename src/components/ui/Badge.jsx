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
  // Status aliases in wide use across call sites.
  success: 'badge-green',
  warning: 'badge-yellow',
  danger: 'badge-red',
  info: 'badge-blue',
  neutral: 'badge-gray',
};

export function Badge({ children, variant = 'gray', className = '', ...rest }) {
  let variantClass = VARIANTS[variant];
  if (variantClass === undefined) {
    if (import.meta.env.DEV) console.warn(`[Badge] unknown variant "${variant}"`);
    variantClass = VARIANTS.gray;
  }
  const classes = ['badge', variantClass, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
