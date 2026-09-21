import { describe, expect, it } from "vitest";
import { planAuthTransition } from "./admin-check";
import { deriveAuthLoading } from "./auth-state";

const session = { user: { id: "u1" } };

// Supabase fires SIGNED_IN on every hidden -> visible transition, not only on a
// real login: GoTrueClient registers a visibilitychange handler that calls
// _recoverAndRefresh(), whose healthy path notifies SIGNED_IN for the session it
// just read back from storage. Blanking isAdmin there puts App.jsx into its
// loading branch, which returns above <Router> and unmounts every open form.
describe("returning to the console from another tab", () => {
  it("keeps the verified admin verdict when the same user comes back", () => {
    expect(planAuthTransition("SIGNED_IN", true, true)).toEqual({
      setAdmin: "keep",
      recheck: false,
    });
  });

  it("never enters the loading state that unmounts the router", () => {
    let isAdmin = true;
    const { setAdmin } = planAuthTransition("SIGNED_IN", true, true);
    if (setAdmin !== "keep") isAdmin = setAdmin;
    expect(deriveAuthLoading(session, isAdmin)).toBe(false);
  });

  it("still gates a genuinely different user, so a re-login cannot flash Access Denied", () => {
    // The bug this file must not reintroduce. An unrecognised user has no
    // verified verdict, so the check has to run behind the loading guard.
    expect(planAuthTransition("SIGNED_OUT", false, false)).toEqual({
      setAdmin: false,
      recheck: false,
    });
    expect(planAuthTransition("SIGNED_IN", true, false)).toEqual({
      setAdmin: null,
      recheck: true,
    });
    let isAdmin = true;
    const { setAdmin } = planAuthTransition("SIGNED_IN", true, false);
    if (setAdmin !== "keep") isAdmin = setAdmin;
    expect(deriveAuthLoading(session, isAdmin)).toBe(true);
  });

  it("revalidates a changed user record without unmounting", () => {
    // USER_UPDATED for the same user should re-run the check, but silently —
    // blanking isAdmin would tear the tree down for a metadata edit.
    expect(planAuthTransition("USER_UPDATED", true, true)).toEqual({
      setAdmin: "keep",
      recheck: true,
    });
  });

  it("leaves a silent token refresh alone", () => {
    expect(planAuthTransition("TOKEN_REFRESHED", true, true)).toEqual({
      setAdmin: "keep",
      recheck: false,
    });
  });
});
