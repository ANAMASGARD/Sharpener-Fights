"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameEvent, GameSnapshot } from "@sharpener/protocol";
import {
  gameAudio,
  readAudioPreferences,
  writeAudioPreferences,
  type AudioPreferences,
} from "./audio";

export function useGameAudio(
  events: readonly GameEvent[],
  snapshot: GameSnapshot | null,
) {
  const [preferences, setPreferences] = useState<AudioPreferences>(() =>
    typeof window === "undefined"
      ? { sfxMuted: false, ambienceMuted: false }
      : readAudioPreferences(window.localStorage),
  );

  useEffect(() => {
    gameAudio.setPreferences(preferences);
    writeAudioPreferences(window.localStorage, preferences);
  }, [preferences]);

  useEffect(() => {
    gameAudio.handleEvents(events);
  }, [events]);

  useEffect(() => {
    gameAudio.updateSlide(snapshot);
    return () => gameAudio.updateSlide(null);
  }, [snapshot]);

  const toggleSfx = useCallback(() => {
    gameAudio.unlock();
    gameAudio.playUiClick();
    setPreferences((value) => ({ ...value, sfxMuted: !value.sfxMuted }));
  }, []);

  const toggleAmbience = useCallback(() => {
    gameAudio.unlock();
    gameAudio.playUiClick();
    setPreferences((value) => ({
      ...value,
      ambienceMuted: !value.ambienceMuted,
    }));
  }, []);

  return { preferences, toggleSfx, toggleAmbience };
}
