// ============================================
// FILE: components/ui/UserNameLink.jsx
// Clickable username component that opens UserDetailDrawer.
// Usage: <UserNameLink userId="uuid" name="John Doe" phone="9876543210" />
// ============================================

import React, { useState } from 'react';
import { UserDetailDrawer } from './UserDetailDrawer';

export function UserNameLink({ userId, name, phone, style }) {
  const [open, setOpen] = useState(false);

  if (!userId) {
    return <span style={style}>{name || '—'}</span>;
  }

  return (
    <>
      <span
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{
          cursor: 'pointer',
          color: 'var(--text)',
          fontWeight: 500,
          borderBottom: '1px dashed var(--text-4)',
          transition: 'color 0.15s, border-color 0.15s',
          ...style,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--primary)';
          e.currentTarget.style.borderBottomColor = 'var(--primary)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.borderBottomColor = 'var(--text-4)';
        }}
        title="Click to view customer details"
      >
        {name || '—'}
      </span>
      {phone && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>{phone}</div>}
      {open && <UserDetailDrawer userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
