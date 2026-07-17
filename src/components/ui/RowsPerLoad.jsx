// ============================================
// FILE: components/ui/RowsPerLoad.jsx
// ============================================

import React from 'react';
import { Select } from './Select';
import { ROWS_PER_LOAD_OPTIONS, setRowsPerLoad, useRowsPerLoad } from '../../lib/rows-per-load';

const OPTIONS = ROWS_PER_LOAD_OPTIONS.map((n) => ({ value: String(n), label: `${n} rows` }));

/**
 * Batch-size picker for the appending lists. Sits in the filter row.
 *
 * Changing it resets the list to a single fresh batch — the alternative is
 * leaving 140 already-loaded rows on screen under a control that now says 50,
 * which describes nothing.
 */
export function RowsPerLoad() {
  const rowsPerLoad = useRowsPerLoad();

  return (
    <Select
      value={String(rowsPerLoad)}
      onChange={(value) => setRowsPerLoad(parseInt(value, 10))}
      options={OPTIONS}
    />
  );
}
