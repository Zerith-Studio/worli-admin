// ============================================
// FILE: components/ui/MiniChart.jsx
// ============================================

import React from 'react';

export function MiniChart({ data, color }) {
  const max = Math.max(...data, 1);
  return (
    <div className="mini-chart">
      {data.map((v, i) => (
        <div 
          key={i} 
          className="mini-bar" 
          style={{ 
            height: `${Math.round((v / max) * 100)}%`, 
            background: color, 
            opacity: 0.7 + (i / data.length) * 0.3 
          }} 
        />
      ))}
    </div>
  );
}
