import { describe, expect, it } from "vitest";
import { parseThreshold } from "./wallet-threshold";

describe("parseThreshold", () => {
  it("parses a numeric setting", () => {
    expect(parseThreshold("150", 100)).toBe(150);
  });

  it("keeps zero", () => {
    expect(parseThreshold("0", 100)).toBe(0);
  });

  it("falls back on a non-numeric value instead of yielding NaN", () => {
    // app_settings is free-form text; "₹200" parseFloats to NaN, which must
    // never reach a .lt('balance', NaN) query.
    expect(parseThreshold("₹200", 100)).toBe(100);
  });

  it("falls back on null/undefined/empty", () => {
    expect(parseThreshold(null, 100)).toBe(100);
    expect(parseThreshold(undefined, 100)).toBe(100);
    expect(parseThreshold("", 100)).toBe(100);
  });

  it("falls back on a negative value", () => {
    expect(parseThreshold("-5", 100)).toBe(100);
  });
});
