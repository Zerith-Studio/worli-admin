// ============================================
// FILE: lib/route-owners.js
// ============================================

// Who holds each route, so the picker label and the displacement confirmation
// resolve it the same way. They used to differ: the label fell back to the
// permanent owner in override mode and the confirmation did not, so the common
// case named a driver and then displaced them without asking.
export function buildRouteOwners(drivers) {
  const owners = new Map();
  for (const d of drivers || []) {
    for (const r of d.assignedRoutes || []) {
      const entry = owners.get(r.routeId) || {};
      entry[r.isPermanent ? 'permanent' : 'override'] = { id: d.id, name: d.name };
      owners.set(r.routeId, entry);
    }
  }
  return owners;
}

// `permanent` looks only at the permanent holder; assigning for today has to
// consider the permanent owner too, because that is who loses the route.
export function resolveRouteHolder(owners, routeId, mode) {
  const owner = owners.get(routeId);
  if (!owner) return null;
  const holder = mode === 'permanent' ? owner.permanent : owner.override || owner.permanent;
  return holder ?? null;
}
