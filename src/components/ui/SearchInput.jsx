// ============================================
// FILE: components/ui/SearchInput.jsx
// ============================================

import React from 'react';

export function SearchInput({ placeholder, value, onChange, className = '' }) {
  return (
    <div className={`search-input ${className}`}>
      <span style={{ color: "var(--text-4)", fontSize: 13 }}>🔍</span>
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
