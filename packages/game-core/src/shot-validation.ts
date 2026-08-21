import {
  ShotCommandSchema,
  type CommandResult,
  type MatchPhase,
  type ShotCommand,
  type Vec3,
} from "@sharpener/protocol";

export type ShotValidationContext = {
  matchId: string;
  roundId: number;
  turnId: number;
  phase: MatchPhase;
  hasSeenShot: (shotId: string) => boolean;
  isLegalHitPoint: (point: Vec3) => boolean;
};

export function validateShotCommand(
  command: ShotCommand,
  context: ShotValidationContext,
): CommandResult {
  if (!ShotCommandSchema.safeParse(command).success) {
    return { accepted: false, reason: "INVALID_COMMAND" };
  }
  if (command.matchId !== context.matchId) {
    return { accepted: false, reason: "WRONG_MATCH" };
  }
  if (command.roundId !== context.roundId) {
    return { accepted: false, reason: "WRONG_ROUND" };
  }
  if (command.turnId !== context.turnId) {
    return { accepted: false, reason: "WRONG_TURN" };
  }
  if (context.phase !== "AIMING") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (context.hasSeenShot(command.shotId)) {
    return { accepted: false, reason: "DUPLICATE_SHOT" };
  }
  if (!context.isLegalHitPoint(command.hitPointLocal)) {
    return { accepted: false, reason: "ILLEGAL_HIT_POINT" };
  }
  return { accepted: true };
}
