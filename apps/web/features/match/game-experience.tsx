"use client";

import { useState } from "react";
import MatchCanvas from "./match-canvas";
import {
  SharpenerSelector,
  type MatchCosmetics,
} from "./sharpener-selector";
import { AudioMenu } from "./audio-menu";
import { useAudioPreferences } from "./use-audio-preferences";

export default function GameExperience() {
  const [cosmetics, setCosmetics] = useState<MatchCosmetics | null>(null);
  const { preferences, toggleMusic, toggleSfx } = useAudioPreferences();

  return (
    <>
      <AudioMenu
        preferences={preferences}
        onToggleMusic={toggleMusic}
        onToggleSfx={toggleSfx}
      />
      {cosmetics ? (
        <MatchCanvas
          cosmetics={cosmetics}
          onChangeSharpener={() => setCosmetics(null)}
        />
      ) : (
        <SharpenerSelector onStart={setCosmetics} />
      )}
    </>
  );
}
