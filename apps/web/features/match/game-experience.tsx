"use client";

import { useRouter } from "next/navigation";
import { SharpenerSelector } from "./sharpener-selector";
import { AudioMenu } from "./audio-menu";
import { useAudioPreferences } from "./use-audio-preferences";

export default function GameExperience() {
  const router = useRouter();
  const { preferences, toggleMusic, toggleSfx } = useAudioPreferences();

  return (
    <>
      <AudioMenu
        preferences={preferences}
        onToggleMusic={toggleMusic}
        onToggleSfx={toggleSfx}
      />
      <SharpenerSelector onStart={() => router.push(process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1" ? "/play/local" : "/modes")} />
    </>
  );
}
