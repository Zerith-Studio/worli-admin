// ============================================
// FILE: components/ui/LoadMore.jsx
// Footer for an appending list: lazy-loads the next batch on scroll, and shows
// how much of the whole is on screen.
// ============================================

import React, { useEffect, useRef } from 'react';

/**
 * @param {number}   shown       Rows currently rendered.
 * @param {number}   total       Rows the server says exist for these filters.
 * @param {function} onLoadMore  Fetch and append the next batch.
 * @param {boolean}  loading     A batch is in flight.
 * @param {string}   [label]     Plural noun for the button ("orders", "rows").
 * @param {boolean}  [auto]      Fire on scroll. Off for lists inside their own
 *                               scroll container where a viewport observer
 *                               would misfire.
 */
export function LoadMore({ shown, total, onLoadMore, loading, label = 'rows', auto = true }) {
  const sentinelRef = useRef(null);

  // Held in a ref so the observer doesn't need re-creating whenever the parent
  // re-renders with a new inline handler.
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  });

  const hasMore = shown < total;

  useEffect(() => {
    if (!auto || !hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current?.();
      },
      // Start fetching before the sentinel is actually visible, so the rows are
      // usually there by the time the reader arrives.
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // Re-observing after each batch is deliberate: the sentinel has moved, and
    // if it is STILL in view (a tall screen, a short batch) we want another
    // round rather than a stuck list.
  }, [auto, hasMore, loading, shown]);

  if (!hasMore) {
    // Only worth saying once the list is long enough that "is this everything?"
    // is a real question.
    return total > 0 && shown > 0 && total > 10 ? (
      <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-4)' }}>
        All {total.toLocaleString('en-IN')} {label} shown
      </div>
    ) : null;
  }

  return (
    <div style={{ padding: '10px 0', textAlign: 'center' }}>
      <div ref={sentinelRef} aria-hidden="true" />
      {/* Kept alongside the scroll trigger, not instead of it: the observer
          never fires for keyboard users, and never fires at all when the list
          is shorter than the viewport. */}
      <button
        type="button"
        onClick={() => loadMoreRef.current?.()}
        disabled={loading}
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 11.5,
          cursor: loading ? 'default' : 'pointer',
          color: 'var(--text-2)',
        }}
      >
        {loading
          ? 'Loading…'
          : `Load more ${label} · ${shown.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`}
      </button>
    </div>
  );
}
