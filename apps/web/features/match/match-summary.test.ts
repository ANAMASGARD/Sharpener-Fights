import { describe, expect, it } from "vitest";
import type { GameSnapshot } from "@sharpener/protocol";
import { createMatchSummary } from "./match-summary";

const finalSnapshot: GameSnapshot = {
  matchId: "local-match",
  tick: 12_000,
  phase: "MATCH_OVER",
  roundId: 4,
  turnId: 17,
  activePlayer: 0,
  aimingTicksRemaining: 0,
  scores: [3, 1],
  roundWinner: 0,
  matchWinner: 0,
  shotCount: 3,
  sharpeners: [
    {
      player: 0,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated: false,
    },
    {
      player: 1,
      position: { x: 0, y: -1, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated: true,
    },
  ],
};

describe("createMatchSummary", () => {
  it("projects the winner and final match statistics", () => {
    expect(
      createMatchSummary(finalSnapshot, ["sunflower-yellow", "graphite-black"]),
    ).toEqual({
      winner: 0,
      winnerName: "Sunflower",
      finalScore: "3–1",
      roundsPlayed: 4,
      totalTurns: 17,
    });
  });
});
