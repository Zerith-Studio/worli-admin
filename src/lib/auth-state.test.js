import { describe, expect, it } from "vitest";
import { deriveAuthLoading } from "./auth-state";

const session = { user: { id: "u1" } };

describe("deriveAuthLoading", () => {
  it("is loading before getSession resolves", () => {
    expect(deriveAuthLoading(undefined, null)).toBe(true);
  });

  it("stays loading while the admin check for a live session is in flight", () => {
    // The reload race: session resolved, checkAdmin not yet. Rendering the
    // Access Denied screen here is the bug this guards against.
    expect(deriveAuthLoading(session, null)).toBe(true);
  });

  it("resolves once the admin check confirms", () => {
    expect(deriveAuthLoading(session, true)).toBe(false);
  });

  it("resolves once the admin check denies", () => {
    expect(deriveAuthLoading(session, false)).toBe(false);
  });

  it("resolves when there is no session to check", () => {
    expect(deriveAuthLoading(null, null)).toBe(false);
  });
});
