"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_AUDIO_PREFERENCES,
  gameAudio,
  readAudioPreferences,
  writeAudioPreferences,
  type AudioPreferences,
} from "./audio";

export function useAudioPreferences() {
  const [preferences, setPreferences] = useState<AudioPreferences>(() =>
    typeof window === "undefined"
      ? DEFAULT_AUDIO_PREFERENCES
      : readAudioPreferences(window.localStorage),
  );

  useEffect(() => {
    gameAudio.setPreferences(preferences);
    writeAudioPreferences(window.localStorage, preferences);
  }, [preferences]);

  useEffect(() => {
    const unlock = () => {
      gameAudio.unlock();
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
  }, []);

  const toggleMusic = useCallback(() => {
    gameAudio.unlock();
    const next = { ...preferences, musicMuted: !preferences.musicMuted };
    gameAudio.setPreferences(next);
    setPreferences(next);
  }, [preferences]);

  const toggleSfx = useCallback(() => {
    gameAudio.unlock();
    const next = { ...preferences, sfxMuted: !preferences.sfxMuted };
    gameAudio.setPreferences(next);
    setPreferences(next);
  }, [preferences]);

  return { preferences, toggleMusic, toggleSfx };
}
