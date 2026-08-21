import RAPIER, { init } from "@dimforge/rapier3d-compat";

let rapierReady: Promise<void> | undefined;

export function initializeRapier() {
  rapierReady ??= init();
  return rapierReady;
}

export { RAPIER };
