"use client";

import { MatchView } from "./match-view";
import type { MatchCosmetics } from "./sharpener-selector";
import { useGameWorker } from "./use-game-worker";

export default function MatchCanvas({
  cosmetics,
  onChangeSharpener,
}: {
  cosmetics: MatchCosmetics;
  onChangeSharpener: () => void;
}) {
  const worker = useGameWorker();
  return <MatchView cosmetics={cosmetics} feed={{ ...worker, localSeat: 0, online: false }} onChangeSharpener={onChangeSharpener} />;
}
