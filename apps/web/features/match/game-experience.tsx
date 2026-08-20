"use client";

import { useState } from "react";
import MatchCanvas from "./match-canvas";
import {
  SharpenerSelector,
  type MatchCosmetics,
} from "./sharpener-selector";

export default function GameExperience() {
  const [cosmetics, setCosmetics] = useState<MatchCosmetics | null>(null);

  if (!cosmetics) return <SharpenerSelector onStart={setCosmetics} />;

  return (
    <MatchCanvas
      cosmetics={cosmetics}
      onChangeSharpener={() => setCosmetics(null)}
    />
  );
}
