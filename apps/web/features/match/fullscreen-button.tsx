"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

function fullscreenSnapshot() {
  return Boolean(document.fullscreenElement);
}

function supportedSnapshot() {
  return Boolean(document.fullscreenEnabled);
}

function subscribeToSupport() {
  return () => undefined;
}

export function FullscreenButton() {
  const fullscreen = useSyncExternalStore(subscribe, fullscreenSnapshot, () => false);
  const supported = useSyncExternalStore(subscribeToSupport, supportedSnapshot, () => false);

  if (!supported) return null;

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
  }

  return (
    <button type="button" onClick={() => void toggleFullscreen()}>
      {fullscreen ? "Exit full screen" : "Full screen"}
    </button>
  );
}
