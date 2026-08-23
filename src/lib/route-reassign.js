// ============================================
// FILE: lib/route-reassign.js
// ============================================

// A failed count is not a zero. The confirmation copy is the only thing
// standing between "reassign this order" and moving a whole route-day, so a
// count that could not be read must never render as a number.
export const COUNT_FAILED = Symbol("route-count-failed");

export function routeCountMessage(count, date, orderNumber) {
  if (count === null) return 'Counting the stops on this route…';
  if (count === COUNT_FAILED) {
    return 'Could not count the stops on this route. Reload before reassigning — this action moves every stop on the route for the day.';
  }
  return `This moves all ${count} stop(s) on this route for ${date} to the driver you pick, not just order ${orderNumber}.`;
}

export function canConfirmRouteReassign({ count, selectedDriver, reassigning }) {
  if (reassigning || !selectedDriver) return false;
  return typeof count === 'number';
}
