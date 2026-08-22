import { createHash } from "node:crypto";
import type { GameSnapshot, PlaybackState } from "@sharpener/protocol";

export function snapshotToPlayback(snapshot: GameSnapshot): PlaybackState {
  return {
    tick: snapshot.tick,
    fighters: snapshot.sharpeners.map(({ player: _player, ...fighter }) => fighter) as PlaybackState["fighters"],
    phase: snapshot.phase,
    activePlayer: snapshot.activePlayer,
    roundScore: [...snapshot.scores],
    roundId: snapshot.roundId,
    turnId: snapshot.turnId,
    aimingTicksRemaining: snapshot.aimingTicksRemaining,
    roundWinner: snapshot.roundWinner,
    matchWinner: snapshot.matchWinner,
    shotCount: snapshot.shotCount,
  };
}

export function playbackToSnapshot(roomId: string, state: PlaybackState): GameSnapshot {
  return {
    matchId: roomId,
    tick: state.tick,
    phase: state.phase,
    roundId: state.roundId,
    turnId: state.turnId,
    activePlayer: state.activePlayer,
    aimingTicksRemaining: state.aimingTicksRemaining,
    scores: [...state.roundScore],
    roundWinner: state.roundWinner,
    matchWinner: state.matchWinner,
    shotCount: state.shotCount,
    sharpeners: [
      { player: 0, ...state.fighters[0] },
      { player: 1, ...state.fighters[1] },
    ],
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  if (typeof value === "number") return Number(value.toFixed(7));
  return value;
}

export function hashPlaybackState(state: PlaybackState) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(state)))
    .digest("hex");
}
