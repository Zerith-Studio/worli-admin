import { describe, expect, it } from "vitest";
import { COUNT_FAILED, routeCountMessage, canConfirmRouteReassign } from "./route-reassign";

describe("routeCountMessage", () => {
  it("says it is still counting before the count lands", () => {
    expect(routeCountMessage(null, "2026-08-23", "ORD-1")).toMatch(/counting/i);
  });

  it("names the stop count once it lands", () => {
    expect(routeCountMessage(12, "2026-08-23", "ORD-1")).toContain("12 stop(s)");
  });

  it("does not claim a number when the count failed", () => {
    const msg = routeCountMessage(COUNT_FAILED, "2026-08-23", "ORD-1");
    expect(msg).not.toMatch(/\d+ stop\(s\)/);
    expect(msg).toMatch(/could not/i);
  });
});

describe("canConfirmRouteReassign", () => {
  const ok = { count: 5, selectedDriver: "d1", reassigning: false };

  it("allows the move once the count is known and a driver is picked", () => {
    expect(canConfirmRouteReassign(ok)).toBe(true);
  });

  it("blocks while the count is still in flight", () => {
    expect(canConfirmRouteReassign({ ...ok, count: null })).toBe(false);
  });

  // The whole point of the confirmation is the number. A failed count rendered
  // as 0 read as "this moves nothing" right before it moved the whole route.
  it("blocks when the count could not be read", () => {
    expect(canConfirmRouteReassign({ ...ok, count: COUNT_FAILED })).toBe(false);
  });

  it("blocks with no driver picked, and while a move is in flight", () => {
    expect(canConfirmRouteReassign({ ...ok, selectedDriver: "" })).toBe(false);
    expect(canConfirmRouteReassign({ ...ok, reassigning: true })).toBe(false);
  });

  it("allows a genuinely empty route", () => {
    expect(canConfirmRouteReassign({ ...ok, count: 0 })).toBe(true);
  });
});
