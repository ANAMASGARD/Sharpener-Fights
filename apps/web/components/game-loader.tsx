"use client";

import dynamic from "next/dynamic";

const GameExperience = dynamic(() => import("@/features/match/game-experience"), {
  ssr: false,
  loading: () => <div className="page-loading">Loading the classroom…</div>,
});

export function GameLoader() {
  return <GameExperience />;
}
