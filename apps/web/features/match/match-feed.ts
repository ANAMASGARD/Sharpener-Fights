import type { GameEvent, GameSnapshot, PlayerIndex, ShotCommand } from "@sharpener/protocol";

export type MatchFeed = {
  snapshot: GameSnapshot | null;
  events: GameEvent[];
  acceptedShotId: string | null;
  error: string | null;
  localSeat: PlayerIndex;
  online: boolean;
  shoot: (command: ShotCommand) => void;
  reset: () => void;
};
