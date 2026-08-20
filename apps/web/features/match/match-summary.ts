import type { GameSnapshot, PlayerIndex } from "@sharpener/protocol";

export type MatchSummary = {
  winner: PlayerIndex;
  winnerName: "Orange" | "Blue";
  finalScore: string;
  roundsPlayed: number;
  totalTurns: number;
};

export function createMatchSummary(
  snapshot: GameSnapshot,
): MatchSummary | null {
  if (snapshot.matchWinner === null) return null;
  return {
    winner: snapshot.matchWinner,
    winnerName: snapshot.matchWinner === 0 ? "Orange" : "Blue",
    finalScore: `${snapshot.scores[0]}–${snapshot.scores[1]}`,
    roundsPlayed: snapshot.roundId,
    totalTurns: snapshot.turnId,
  };
}
