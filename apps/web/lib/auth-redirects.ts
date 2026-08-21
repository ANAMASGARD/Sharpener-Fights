export const AUTHENTICATED_HOME_PATH = "/";

export const clerkProviderRedirects = {
  signInFallbackRedirectUrl: AUTHENTICATED_HOME_PATH,
  signUpFallbackRedirectUrl: AUTHENTICATED_HOME_PATH,
} as const;

export const clerkSignInPageRedirects = {
  forceRedirectUrl: AUTHENTICATED_HOME_PATH,
  signUpForceRedirectUrl: AUTHENTICATED_HOME_PATH,
} as const;
