"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, GameSnapshot, ShotCommand } from "@sharpener/protocol";

type WorkerMessage =
  | { type: "READY"; snapshot: GameSnapshot }
  | { type: "SNAPSHOT"; snapshot: GameSnapshot; events: GameEvent[] }
  | { type: "COMMAND_REJECTED"; reason: string }
  | { type: "ERROR"; message: string };

export function useGameWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./game.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "READY") setSnapshot(message.snapshot);
      if (message.type === "SNAPSHOT") {
        setSnapshot(message.snapshot);
        setEvents(message.events);
      }
      if (message.type === "COMMAND_REJECTED") setError(message.reason);
      if (message.type === "ERROR") setError(message.message);
    };
    worker.onerror = () => setError("The physics worker stopped unexpectedly.");
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const shoot = useCallback((command: ShotCommand) => {
    setError(null);
    workerRef.current?.postMessage({ type: "SHOT", command });
  }, []);

  const reset = useCallback(() => {
    setError(null);
    workerRef.current?.postMessage({ type: "RESET" });
  }, []);

  return { snapshot, events, error, shoot, reset };
}
