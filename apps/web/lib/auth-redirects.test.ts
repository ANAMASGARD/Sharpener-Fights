import { describe, expect, it } from "vitest";
import {
  AUTHENTICATED_HOME_PATH,
  clerkProviderRedirects,
  clerkSignInPageRedirects,
} from "./auth-redirects";

describe("Clerk post-authentication redirects", () => {
  it("returns completed sign-in and sign-up flows to the same-origin game home", () => {
    expect(AUTHENTICATED_HOME_PATH).toBe("/");
    expect(clerkProviderRedirects).toEqual({
      signInFallbackRedirectUrl: "/",
      signUpFallbackRedirectUrl: "/",
    });
    expect(clerkSignInPageRedirects).toEqual({
      forceRedirectUrl: "/",
      signUpForceRedirectUrl: "/",
    });
  });
});
