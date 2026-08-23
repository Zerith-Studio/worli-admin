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
// `tenure` is how the holder actually holds it, which is not the mode being
// applied — taking a route "for today" from someone who holds it permanently
// must not describe them as holding it for today.
export function resolveRouteHolder(owners, routeId, mode) {
  const owner = owners.get(routeId);
  if (!owner) return null;
  if (mode === 'permanent') {
    return owner.permanent ? { ...owner.permanent, tenure: 'permanent' } : null;
  }
  if (owner.override) return { ...owner.override, tenure: 'override' };
  return owner.permanent ? { ...owner.permanent, tenure: 'permanent' } : null;
}
