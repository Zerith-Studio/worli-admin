import { describe, expect, it } from "vitest";
import { planAuthTransition, interpretAdminResult, checkAdminWithRetry } from "./admin-check";

describe("planAuthTransition", () => {
  it("resets isAdmin to null and rechecks on sign-in, so the loading guard covers the check", () => {
    // The re-login flash: without resetting to null, deriveAuthLoading sees the
    // stale value and renders Access Denied while checkAdmin is still in flight.
    expect(planAuthTransition("SIGNED_IN", true)).toEqual({ setAdmin: null, recheck: true });
    expect(planAuthTransition("USER_UPDATED", true)).toEqual({ setAdmin: null, recheck: true });
  });

  it("clears isAdmin and does not recheck when there is no session", () => {
    expect(planAuthTransition("SIGNED_OUT", false)).toEqual({ setAdmin: false, recheck: false });
  });

  it("leaves isAdmin untouched on a silent token refresh", () => {
    expect(planAuthTransition("TOKEN_REFRESHED", true)).toEqual({ setAdmin: "keep", recheck: false });
  });
});

describe("interpretAdminResult", () => {
  it("reads a present row as admin", () => {
    expect(interpretAdminResult({ data: { id: "u1" }, error: null })).toBe("admin");
  });

  it("reads an absent row as not-admin", () => {
    expect(interpretAdminResult({ data: null, error: null })).toBe("not-admin");
  });

  it("reads a query error as error, not a denial", () => {
    // supabase-js resolves failures as { error }; treating that as not-admin
    // locked a real admin out on a transient blip.
    expect(interpretAdminResult({ data: null, error: { message: "network" } })).toBe("error");
  });
});

describe("checkAdminWithRetry", () => {
  const noSleep = () => Promise.resolve();

  it("retries a transient error and succeeds", async () => {
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return Promise.resolve(calls < 2 ? { data: null, error: { message: "blip" } } : { data: { id: "u1" }, error: null });
    };
    expect(await checkAdminWithRetry(queryFn, { retries: 2, sleep: noSleep })).toBe("admin");
    expect(calls).toBe(2);
  });

  it("does not retry a clean not-admin result", async () => {
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return Promise.resolve({ data: null, error: null });
    };
    expect(await checkAdminWithRetry(queryFn, { retries: 3, sleep: noSleep })).toBe("not-admin");
    expect(calls).toBe(1);
  });

  it("gives up after exhausting retries on a persistent error (fails closed)", async () => {
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return Promise.resolve({ data: null, error: { message: "down" } });
    };
    expect(await checkAdminWithRetry(queryFn, { retries: 2, sleep: noSleep })).toBe("error");
    expect(calls).toBe(3);
  });
});

describe("checkAdminWithRetry — failures that never resolve cleanly", () => {
  it("treats a thrown query as an error rather than propagating it", async () => {
    const sleep = () => Promise.resolve();
    const outcome = await checkAdminWithRetry(
      () => Promise.reject(new Error("Query timed out")),
      { retries: 1, sleep }
    );
    expect(outcome).toBe("error");
  });

  it("still resolves admin when a throw is followed by a good response", async () => {
    const sleep = () => Promise.resolve();
    let call = 0;
    const outcome = await checkAdminWithRetry(
      () => {
        call += 1;
        return call === 1
          ? Promise.reject(new Error("network"))
          : Promise.resolve({ data: { id: "a" }, error: null });
      },
      { retries: 2, sleep }
    );
    expect(outcome).toBe("admin");
  });
});
