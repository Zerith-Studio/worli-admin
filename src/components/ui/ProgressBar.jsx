// ============================================
// FILE: components/ui/ProgressBar.jsx
// ============================================

import React from 'react';

export function ProgressBar({ value, max, color = "#1A6FE8" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ width: `${pct}%`, background: color }} 
      />
    </div>
  );
}
