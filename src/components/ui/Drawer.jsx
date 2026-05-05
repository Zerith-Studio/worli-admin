// ============================================
// FILE: components/ui/Drawer.jsx
// ============================================

import React from 'react';

export function Drawer({ title, onClose, children, footer, wide }) {
  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" style={wide ? { width: 540, maxWidth: '95vw' } : undefined}>
        <div className="drawer-header">
          <div className="drawer-title">{title}</div>
          <div className="drawer-close" onClick={onClose}>✕</div>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
