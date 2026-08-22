"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InstallTicket, UpdateTicket } from "./install-ticket";
import { PwaContext } from "./pwa-context";
import {
  installSurface,
  isInstallPromptRoute,
  isIosInstallPlatform,
  shouldSuppressInstallPrompt,
  type InstallSurface,
} from "./pwa-policy";

const DISMISSED_AT_KEY = "sharpener-fights:pwa-install-dismissed-at";
const PROMPT_DELAY_MS = 8_000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function displayModeInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as NavigatorWithStandalone).standalone);
}

function readDismissedAt() {
  const value = window.localStorage.getItem(DISMISSED_AT_KEY);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PwaRuntime({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [checkingConnectivity, setCheckingConnectivity] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [delayElapsedAt, setDelayElapsedAt] = useState(0);
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const reloading = useRef(false);

  const checkConnectivity = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      setCheckingConnectivity(false);
      return;
    }
    setCheckingConnectivity(true);
    try {
      const response = await fetch("/api/connectivity", { cache: "no-store" });
      setOnline(response.ok);
    } catch {
      setOnline(false);
    } finally {
      setCheckingConnectivity(false);
    }
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setInstalled(displayModeInstalled());
      setDismissedAt(readDismissedAt());
    }, 0);
    const timer = window.setTimeout(() => setDelayElapsedAt(Date.now()), PROMPT_DELAY_MS);
    const markEngaged = () => setEngaged(true);
    document.addEventListener("pointerdown", markEngaged, { once: true, passive: true });
    document.addEventListener("keydown", markEngaged, { once: true });
    return () => {
      window.clearTimeout(initialize);
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", markEngaged);
      document.removeEventListener("keydown", markEngaged);
    };
  }, []);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setNativePrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setNativePrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkConnectivity(), 0);
    window.addEventListener("online", checkConnectivity);
    window.addEventListener("offline", checkConnectivity);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener("online", checkConnectivity);
      window.removeEventListener("offline", checkConnectivity);
    };
  }, [checkConnectivity]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let active = true;

    const observeRegistration = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (active && installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(registration.waiting ?? installing);
          }
        });
      });
    };

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(observeRegistration)
      .catch(() => undefined);

    const reloadOnControl = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnControl);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControl);
    };
  }, []);

  const surface: InstallSurface = typeof navigator === "undefined"
    ? "unavailable"
    : installSurface({
        installed,
        nativePrompt: nativePrompt !== null,
        iosManual: isIosInstallPlatform(navigator),
      });
  const promptVisible = engaged
    && delayElapsedAt !== 0
    && isInstallPromptRoute(pathname)
    && (surface === "native" || surface === "ios-manual")
    && !shouldSuppressInstallPrompt(dismissedAt, delayElapsedAt);
  const safeToUpdate = isInstallPromptRoute(pathname);

  const dismissInstall = () => {
    const now = Date.now();
    window.localStorage.setItem(DISMISSED_AT_KEY, String(now));
    setDismissedAt(now);
  };
  const requestInstall = async () => {
    if (!nativePrompt) return;
    await nativePrompt.prompt();
    const choice = await nativePrompt.userChoice;
    setNativePrompt(null);
    if (choice.outcome === "dismissed") dismissInstall();
  };
  const applyUpdate = () => waitingWorker?.postMessage({ type: "SKIP_WAITING" });

  const context = useMemo(() => ({ online, checkingConnectivity, installed }), [online, checkingConnectivity, installed]);

  return (
    <PwaContext.Provider value={context}>
      {children}
      {promptVisible && (
        <InstallTicket
          surface={surface as "native" | "ios-manual"}
          onInstall={() => void requestInstall()}
          onDismiss={dismissInstall}
        />
      )}
      {waitingWorker && safeToUpdate && !updateDismissed && (
        <UpdateTicket onUpdate={applyUpdate} onDismiss={() => setUpdateDismissed(true)} />
      )}
    </PwaContext.Provider>
  );
}
