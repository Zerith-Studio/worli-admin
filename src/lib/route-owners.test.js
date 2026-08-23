import { describe, expect, it } from "vitest";
import { buildRouteOwners, resolveRouteHolder } from "./route-owners";

const DRIVERS = [
  { id: "swayam", name: "Swayam", assignedRoutes: [{ routeId: "bhattu", isPermanent: true }] },
  { id: "asha", name: "Asha", assignedRoutes: [{ routeId: "worli", isPermanent: false }] },
];

describe("resolveRouteHolder", () => {
  const owners = buildRouteOwners(DRIVERS);

  it("names the permanent owner in permanent mode", () => {
    expect(resolveRouteHolder(owners, "bhattu", "permanent")?.name).toBe("Swayam");
  });

  // The bug this exists to stop: assigning a route "for today" that someone
  // else permanently holds took it from them with no confirmation, while the
  // picker label said "— currently Swayam".
  it("falls back to the permanent owner in override mode", () => {
    expect(resolveRouteHolder(owners, "bhattu", "override")?.name).toBe("Swayam");
  });

  it("prefers today's override over the permanent owner", () => {
    const withBoth = buildRouteOwners([
      ...DRIVERS,
      { id: "ravi", name: "Ravi", assignedRoutes: [{ routeId: "bhattu", isPermanent: false }] },
    ]);
    expect(resolveRouteHolder(withBoth, "bhattu", "override")?.name).toBe("Ravi");
    expect(resolveRouteHolder(withBoth, "bhattu", "permanent")?.name).toBe("Swayam");
  });

  it("ignores a same-day override when assigning permanently", () => {
    expect(resolveRouteHolder(owners, "worli", "permanent")).toBeNull();
  });

  it("reports how the holder actually holds it, not the mode being applied", () => {
    // Taking a route "for today" from its permanent owner must not tell the
    // admin it is "assigned for today" to them.
    expect(resolveRouteHolder(owners, "bhattu", "override")?.tenure).toBe("permanent");
    expect(resolveRouteHolder(owners, "bhattu", "permanent")?.tenure).toBe("permanent");

    const withBoth = buildRouteOwners([
      ...DRIVERS,
      { id: "ravi", name: "Ravi", assignedRoutes: [{ routeId: "bhattu", isPermanent: false }] },
    ]);
    expect(resolveRouteHolder(withBoth, "bhattu", "override")?.tenure).toBe("override");
  });

  it("returns null for an unheld route", () => {
    expect(resolveRouteHolder(owners, "nowhere", "override")).toBeNull();
  });
});
