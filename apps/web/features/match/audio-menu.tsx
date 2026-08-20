"use client";

import { useState } from "react";
import type { AudioPreferences } from "./audio";
import styles from "./audio-menu.module.css";

export function AudioMenu({
  preferences,
  onToggleMusic,
  onToggleSfx,
}: {
  preferences: AudioPreferences;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
}) {
  const [open, setOpen] = useState(false);
  const allMuted = preferences.musicMuted && preferences.sfxMuted;

  return (
    <aside className={styles["audio-menu"]} data-part="audio-menu">
      <button
        type="button"
        className={styles["audio-trigger"]}
        aria-label="Sound settings"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9.4v5.2h3.7l4.6 3.7V5.7L7.7 9.4H4Z" />
          {allMuted ? (
            <path d="m16 9 5 5m0-5-5 5" />
          ) : (
            <path d="M15.7 8.2a5.2 5.2 0 0 1 0 7.6m2.4-10a8.6 8.6 0 0 1 0 12.4" />
          )}
        </svg>
      </button>

      {open && (
        <div className={styles["audio-panel"]} role="group" aria-label="Audio controls">
          <span className={styles["panel-label"]}>Sound desk</span>
          <button
            type="button"
            aria-pressed={preferences.musicMuted}
            aria-label={preferences.musicMuted ? "Unmute background music" : "Mute background music"}
            onClick={onToggleMusic}
          >
            <span>Music</span>
            <b>{preferences.musicMuted ? "Muted" : "On"}</b>
          </button>
          <button
            type="button"
            aria-pressed={preferences.sfxMuted}
            aria-label={preferences.sfxMuted ? "Unmute sound effects" : "Mute sound effects"}
            onClick={onToggleSfx}
          >
            <span>Effects</span>
            <b>{preferences.sfxMuted ? "Muted" : "On"}</b>
          </button>
        </div>
      )}
    </aside>
  );
}
