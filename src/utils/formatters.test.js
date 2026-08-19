import { describe, expect, it } from "vitest";
import { istToday, istDate } from "./formatters";

describe("istToday", () => {
  it("returns the IST date, not the UTC date, during the early-morning delivery window", () => {
    // 20:00 UTC on Aug 19 is 01:30 IST on Aug 20 — inside the 00:00–05:30 IST
    // window where toISOString() reports yesterday.
    const now = new Date("2026-08-19T20:00:00Z");
    expect(now.toISOString().split("T")[0]).toBe("2026-08-19");
    expect(istToday(now)).toBe("2026-08-20");
  });

  it("agrees with UTC when both are on the same calendar day", () => {
    const now = new Date("2026-08-19T12:00:00Z"); // 17:30 IST same day
    expect(istToday(now)).toBe("2026-08-19");
  });

  it("defaults to the current clock and returns YYYY-MM-DD", () => {
    expect(istToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("istDate", () => {
  it("offsets by whole IST days", () => {
    const now = new Date("2026-08-19T20:00:00Z"); // Aug 20 IST
    expect(istDate(1, now)).toBe("2026-08-21");
    expect(istDate(-6, now)).toBe("2026-08-14");
  });

  it("crosses month boundaries", () => {
    const now = new Date("2026-08-31T12:00:00Z");
    expect(istDate(1, now)).toBe("2026-09-01");
  });
});
