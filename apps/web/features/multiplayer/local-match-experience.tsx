"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MatchCanvas from "../match/match-canvas";
import { chooseOpponentCosmetic, readStoredCosmetic } from "../match/cosmetics";
import type { MatchCosmetics } from "../match/sharpener-selector";

export function LocalMatchExperience() {
  const router = useRouter();
  const [cosmetics] = useState<MatchCosmetics>(() => {
    const selected = typeof window === "undefined" ? "ember-red" : readStoredCosmetic(window.localStorage);
    return [selected, chooseOpponentCosmetic(selected, 0.37)];
  });
  return <MatchCanvas cosmetics={cosmetics} onChangeSharpener={() => router.push("/")} />;
}
