import { describe, expect, it } from "vitest";
import { authResultError } from "./login-flow";

describe("authResultError", () => {
  it("surfaces the error message from a failed auth result", () => {
    expect(
      authResultError(
        { success: false, error: "Access denied. You are not an admin." },
        "Login failed"
      )
    ).toBe("Access denied. You are not an admin.");
  });

  it("returns null on success", () => {
    expect(authResultError({ success: true }, "Login failed")).toBeNull();
  });

  it("falls back when the failure carries no message", () => {
    expect(authResultError({ success: false }, "Failed to send OTP")).toBe(
      "Failed to send OTP"
    );
  });

  it("falls back when there is no result at all", () => {
    expect(authResultError(undefined, "Login failed")).toBe("Login failed");
  });
});
