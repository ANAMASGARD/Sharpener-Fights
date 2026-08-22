import type { GameSnapshot, PlayerIndex } from "@sharpener/protocol";
import { resolveMatchCosmetics } from "./cosmetics";
import type { MatchCosmetics } from "./sharpener-selector";

export type MatchSummary = {
  winner: PlayerIndex;
  winnerName: string;
  finalScore: string;
  roundsPlayed: number;
  totalTurns: number;
};

export function createMatchSummary(
  snapshot: GameSnapshot,
  cosmetics: MatchCosmetics,
): MatchSummary | null {
  if (snapshot.matchWinner === null) return null;
  const players = resolveMatchCosmetics(cosmetics);
  return {
    winner: snapshot.matchWinner,
    winnerName: players[snapshot.matchWinner].name,
    finalScore: `${snapshot.scores[0]}–${snapshot.scores[1]}`,
    roundsPlayed: snapshot.roundId,
    totalTurns: snapshot.turnId,
  };
}
