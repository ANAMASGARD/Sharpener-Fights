import type { GameSnapshot, MatchPhase, PlayerIndex } from "@sharpener/protocol";

export type ShotAuthority = {
  matchId: string;
  roundId: number;
  turnId: number;
  player: PlayerIndex;
};

type AuthoritySnapshot = Pick<
  GameSnapshot,
  "matchId" | "roundId" | "turnId" | "activePlayer" | "phase"
> & { phase: MatchPhase };

export type AimPowerState = {
  turnId: number;
  power01: number;
};

export function hasShotAuthority(
  authority: ShotAuthority,
  snapshot: AuthoritySnapshot,
) {
  return (
    snapshot.phase === "AIMING" &&
    snapshot.matchId === authority.matchId &&
    snapshot.roundId === authority.roundId &&
    snapshot.turnId === authority.turnId &&
    snapshot.activePlayer === authority.player
  );
}

export function visibleAimPower(
  aimPower: AimPowerState | null,
  turnId: number,
) {
  return aimPower?.turnId === turnId ? aimPower.power01 : 0;
}
