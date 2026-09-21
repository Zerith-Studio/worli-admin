// ============================================
// FILE: lib/refresh-gate.js
// ============================================

// Whether a silent background refresh may run right now.
//
// The polling in useDataRefresh replaces the rows a page is rendering without
// any visible cue, which is correct for an idle console and wrong the moment
// someone is working inside it: a refresh landing mid-drag collapses the
// selection being copied out to a sheet, and one landing while a form is open
// re-renders the table underneath it. Both were reported from the dashboard.
//
// Skipping a tick only delays data by one interval — the next tick picks it up
// once the page is idle again.
export function shouldBackgroundRefresh({ visible, hasTextSelection, isEditing }) {
  return visible && !hasTextSelection && !isEditing;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// Read the three facts above off the DOM. Split from the predicate so the rules
// stay testable without a browser environment, which this repo has no setup for.
export function readRefreshContext(doc, getSelection) {
  const selection = typeof getSelection === 'function' ? getSelection() : null;
  const active = doc?.activeElement;
  return {
    visible: doc?.visibilityState === 'visible',
    hasTextSelection:
      !!selection && !selection.isCollapsed && String(selection).trim().length > 0,
    isEditing: EDITABLE_TAGS.has(active?.tagName) || active?.isContentEditable === true,
  };
}
