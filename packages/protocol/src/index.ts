import { z } from "zod";

export const MatchPhaseSchema = z.enum([
  "AIMING",
  "MOVING",
  "SETTLING",
  "ROUND_OVER",
  "MATCH_OVER",
]);

export type MatchPhase = z.infer<typeof MatchPhaseSchema>;

export const SharpenerCosmeticIdSchema = z.enum([
  "ember-red",
  "ocean-blue",
  "sunflower-yellow",
  "classroom-green",
  "graphite-black",
  "aluminium-silver",
]);

export type SharpenerCosmeticId = z.infer<typeof SharpenerCosmeticIdSchema>;

const FiniteNumberSchema = z.number().finite();

export const Vec3Schema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
  z: FiniteNumberSchema,
});

export const ShotCommandSchema = z.object({
  type: z.literal("SHOT"),
  matchId: z.string().min(1).max(128),
  roundId: z.number().int().positive(),
  turnId: z.number().int().positive(),
  shotId: z.string().min(1).max(128),
  direction: z
    .object({
      x: FiniteNumberSchema,
      z: FiniteNumberSchema,
    })
    .refine(
      ({ x, z }) => Math.abs(Math.hypot(x, z) - 1) <= 0.01,
      "Shot direction must be normalized",
    ),
  power01: FiniteNumberSchema.min(0).max(1),
  hitPointLocal: Vec3Schema,
});

export type ShotCommand = z.infer<typeof ShotCommandSchema>;

export type PlayerIndex = 0 | 1;

export type ContactKind =
  | "SHARPENER_SHARPENER"
  | "SHARPENER_TABLE"
  | "SHARPENER_FLOOR";

export type CommandResult =
  | { accepted: true }
  | {
      accepted: false;
      reason:
        | "INVALID_COMMAND"
        | "WRONG_MATCH"
        | "WRONG_ROUND"
        | "WRONG_TURN"
        | "WRONG_PHASE"
        | "DUPLICATE_SHOT"
        | "ILLEGAL_HIT_POINT";
    };

export type BodySnapshot = {
  player: PlayerIndex;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  eliminated: boolean;
};

export type GameSnapshot = {
  matchId: string;
  tick: number;
  phase: MatchPhase;
  roundId: number;
  turnId: number;
  activePlayer: PlayerIndex;
  aimingTicksRemaining: number;
  scores: readonly [number, number];
  roundWinner: PlayerIndex | null;
  matchWinner: PlayerIndex | null;
  shotCount: number;
  sharpeners: readonly [BodySnapshot, BodySnapshot];
};

export type GameEvent =
  | {
      type: "SHOT_ACCEPTED";
      player: PlayerIndex;
      shotId: string;
    }
  | {
      type: "TURN_PASSED";
      player: PlayerIndex;
      reason: "TIMER_EXPIRED";
    }
  | {
      type: "PHASE_CHANGED";
      phase: MatchPhase;
    }
  | {
      type: "SHARPENER_ELIMINATED";
      player: PlayerIndex;
    }
  | {
      type: "FALL_STARTED";
      player: PlayerIndex;
    }
  | {
      type: "CONTACT";
      kind: ContactKind;
      player: PlayerIndex;
      otherPlayer?: PlayerIndex;
      strength01: number;
    }
  | {
      type: "ROUND_ENDED";
      roundId: number;
      winner: PlayerIndex | null;
      reason: "KNOCKOUT" | "DOUBLE_FALL" | "SHOT_LIMIT";
    }
  | {
      type: "MATCH_ENDED";
      winner: PlayerIndex;
    };

export const ClientRoomMessageSchema = z.discriminatedUnion("type", [
  ShotCommandSchema,
]);

export type ClientRoomMessage = z.infer<typeof ClientRoomMessageSchema>;
