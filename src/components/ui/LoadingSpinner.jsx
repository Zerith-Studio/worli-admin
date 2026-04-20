// ============================================
// FILE: components/ui/LoadingSpinner.jsx
// ============================================

import React from 'react';

export function LoadingSpinner() {
  return <div className="spinner" />;
}

export function LoadingOverlay() {
  return (
    <div className="loading-overlay">
      <LoadingSpinner />
    </div>
  );
}
