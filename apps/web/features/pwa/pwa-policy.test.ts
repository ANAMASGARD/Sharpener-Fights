import { describe, expect, it } from "vitest";
import {
  INSTALL_DISMISSAL_COOLDOWN_MS,
  installSurface,
  isInstallPromptRoute,
  isIosInstallPlatform,
  isOfflineGameRoute,
  shouldSuppressInstallPrompt,
} from "./pwa-policy";

describe("PWA route policy", () => {
  it("keeps only the selector, mode desk, and local match in the offline game shell", () => {
    expect(["/", "/modes", "/play/local"].map(isOfflineGameRoute)).toEqual([
      true,
      true,
      true,
    ]);

    expect(["/queue", "/invite/code", "/play/room-id", "/sign-in"].map(isOfflineGameRoute)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("offers installation only on safe pre-match screens", () => {
    expect(isInstallPromptRoute("/")).toBe(true);
    expect(isInstallPromptRoute("/modes")).toBe(true);
    expect(isInstallPromptRoute("/play/local")).toBe(false);
    expect(isInstallPromptRoute("/play/room-id")).toBe(false);
  });
});

describe("PWA install policy", () => {
  it("recognizes iPhone and desktop-identified iPadOS without misclassifying desktop Safari", () => {
    expect(isIosInstallPlatform({ userAgent: "Mozilla/5.0 (iPhone)", platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
    expect(isIosInstallPlatform({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIosInstallPlatform({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  });

  it("uses a native prompt when available and iOS instructions only when needed", () => {
    expect(installSurface({ installed: true, nativePrompt: true, iosManual: true })).toBe("installed");
    expect(installSurface({ installed: false, nativePrompt: true, iosManual: true })).toBe("native");
    expect(installSurface({ installed: false, nativePrompt: false, iosManual: true })).toBe("ios-manual");
    expect(installSurface({ installed: false, nativePrompt: false, iosManual: false })).toBe("unavailable");
  });

  it("suppresses a dismissed ticket for fourteen days", () => {
    const now = Date.UTC(2026, 7, 21);
    expect(shouldSuppressInstallPrompt(now - INSTALL_DISMISSAL_COOLDOWN_MS + 1, now)).toBe(true);
    expect(shouldSuppressInstallPrompt(now - INSTALL_DISMISSAL_COOLDOWN_MS, now)).toBe(false);
    expect(shouldSuppressInstallPrompt(null, now)).toBe(false);
  });
});
