export const INSTALL_DISMISSAL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1_000;

const OFFLINE_GAME_ROUTES = new Set(["/", "/modes", "/play/local"]);
const INSTALL_PROMPT_ROUTES = new Set(["/", "/modes"]);

export type InstallSurface = "installed" | "native" | "ios-manual" | "unavailable";

export function isIosInstallPlatform(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}) {
  return /iPad|iPhone|iPod/.test(input.userAgent)
    || (input.platform === "MacIntel" && input.maxTouchPoints > 1);
}

export function isOfflineGameRoute(pathname: string) {
  return OFFLINE_GAME_ROUTES.has(pathname);
}

export function isInstallPromptRoute(pathname: string) {
  return INSTALL_PROMPT_ROUTES.has(pathname);
}

export function installSurface(input: {
  installed: boolean;
  nativePrompt: boolean;
  iosManual: boolean;
}): InstallSurface {
  if (input.installed) return "installed";
  if (input.nativePrompt) return "native";
  if (input.iosManual) return "ios-manual";
  return "unavailable";
}

export function shouldSuppressInstallPrompt(dismissedAt: number | null, now: number) {
  return dismissedAt !== null && now - dismissedAt < INSTALL_DISMISSAL_COOLDOWN_MS;
}
