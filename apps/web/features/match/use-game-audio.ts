"use client";

import { useEffect, useRef } from "react";
import type { GameEvent, GameSnapshot } from "@sharpener/protocol";
import { gameAudio } from "./audio";

export function useGameAudio(
  events: readonly GameEvent[],
  snapshot: GameSnapshot | null,
) {
  const previousPhase = useRef(snapshot?.phase ?? null);

  useEffect(() => {
    gameAudio.handleEvents(events);
  }, [events]);

  useEffect(() => {
    gameAudio.updateSlide(snapshot);
    return () => gameAudio.updateSlide(null);
  }, [snapshot]);

  useEffect(() => {
    const phase = snapshot?.phase ?? null;
    if (phase === "MATCH_OVER" && previousPhase.current !== "MATCH_OVER") {
      gameAudio.playVictory();
    } else if (
      previousPhase.current === "MATCH_OVER" &&
      phase !== "MATCH_OVER"
    ) {
      gameAudio.resetVictory();
    }
    previousPhase.current = phase;
  }, [snapshot?.phase]);
}
