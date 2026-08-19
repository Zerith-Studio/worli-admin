// ============================================
// FILE: components/ui/Button.jsx
// ============================================

import React from 'react';

const VARIANTS = {
  default: '',
  primary: 'btn-primary',
  danger: 'btn-danger',
  // Aliases in wide use across call sites; base .btn is the neutral
  // bordered style they intend.
  secondary: '',
  outline: '',
};

const SIZES = {
  default: '',
  sm: 'btn-sm',
};

export function Button({
  children,
  variant = 'default',
  size = 'default',
  type = 'button',
  className = '',
  ...rest
}) {
  let variantClass = VARIANTS[variant];
  if (variantClass === undefined) {
    if (import.meta.env.DEV) console.warn(`[Button] unknown variant "${variant}"`);
    variantClass = '';
  }
  const classes = ['btn', variantClass, SIZES[size] || '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
