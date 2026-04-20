// ============================================
// FILE: components/ui/Pagination.jsx
// ============================================

import React from 'react';
import { Button } from './Button';

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  
  return (
    <div className="pagination">
      <span className="pagination-info">Page {page} of {totalPages}</span>
      <div className="pagination-controls">
        <Button 
          size="sm" 
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Prev
        </Button>
        <Button 
          size="sm" 
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
