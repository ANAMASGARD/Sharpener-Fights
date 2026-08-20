/// <reference lib="webworker" />

import {
  FIXED_DT,
  createGameSimulation,
  type GameSimulation,
} from "@sharpener/game-core";
import type { GameEvent, GameSnapshot, ShotCommand } from "@sharpener/protocol";

type IncomingMessage =
  | { type: "SHOT"; command: ShotCommand }
  | { type: "RESET" };

type WorkerMessage =
  | { type: "READY"; snapshot: GameSnapshot }
  | { type: "SNAPSHOT"; snapshot: GameSnapshot; events: GameEvent[] }
  | { type: "COMMAND_REJECTED"; reason: string }
  | { type: "ERROR"; message: string };

const worker = self as DedicatedWorkerGlobalScope;
let simulation: GameSimulation | undefined;
let previousTime = performance.now();
let accumulator = 0;
let lastSnapshotTime = 0;
let timeout: ReturnType<typeof setTimeout> | undefined;

function post(message: WorkerMessage) {
  worker.postMessage(message);
}

function scheduleLoop() {
  timeout = setTimeout(runLoop, 4);
}

function runLoop() {
  if (!simulation) return;
  const now = performance.now();
  accumulator += Math.min((now - previousTime) / 1000, 0.25);
  previousTime = now;

  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 30) {
    simulation.step();
    accumulator -= FIXED_DT;
    steps += 1;
  }

  if (now - lastSnapshotTime >= 1000 / 60) {
    post({
      type: "SNAPSHOT",
      snapshot: simulation.getSnapshot(),
      events: simulation.drainEvents(),
    });
    lastSnapshotTime = now;
  }
  scheduleLoop();
}

worker.onmessage = (event: MessageEvent<IncomingMessage>) => {
  if (!simulation) return;
  if (event.data.type === "RESET") {
    simulation.reset();
    return;
  }

  const result = simulation.applyCommand(event.data.command);
  if (!result.accepted) {
    post({ type: "COMMAND_REJECTED", reason: result.reason });
  }
};

createGameSimulation()
  .then((created) => {
    simulation = created;
    previousTime = performance.now();
    post({ type: "READY", snapshot: created.getSnapshot() });
    scheduleLoop();
  })
  .catch((error: unknown) => {
    post({
      type: "ERROR",
      message: error instanceof Error ? error.message : "Physics failed to load",
    });
  });

worker.addEventListener("close", () => {
  if (timeout) clearTimeout(timeout);
  simulation?.dispose();
});

export {};
