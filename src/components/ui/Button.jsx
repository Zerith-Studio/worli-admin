// ============================================
// FILE: components/ui/Button.jsx
// ============================================

import React from 'react';

const VARIANTS = {
  default: '',
  primary: 'btn-primary',
  danger: 'btn-danger',
};

const SIZES = {
  default: '',
  sm: 'btn-sm',
};

export function Button({ 
  children, 
  variant = 'default', 
  size = 'default', 
  disabled = false,
  onClick,
  type = 'button',
  className = ''
}) {
  return (
    <button
      type={type}
      className={`btn ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
