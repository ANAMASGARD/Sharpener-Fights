import { z } from "zod";
import {
  FiniteNumberSchema,
  IdentifierSchema,
  NonNegativeIntegerSchema,
  QuaternionSchema,
  Vec3Schema,
} from "./common";

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

export const PlayerIndexSchema = z.union([z.literal(0), z.literal(1)]);
export type PlayerIndex = z.infer<typeof PlayerIndexSchema>;

export const ShotCommandSchema = z.object({
  type: z.literal("SHOT"),
  matchId: IdentifierSchema,
  roundId: z.number().int().positive(),
  turnId: z.number().int().positive(),
  shotId: IdentifierSchema,
  direction: z
    .object({ x: FiniteNumberSchema, z: FiniteNumberSchema })
    .refine(
      ({ x, z }) => Math.abs(Math.hypot(x, z) - 1) <= 0.01,
      "Shot direction must be normalized",
    ),
  power01: FiniteNumberSchema.min(0).max(1),
  hitPointLocal: Vec3Schema,
});
export type ShotCommand = z.infer<typeof ShotCommandSchema>;

export const CommandRejectionReasonSchema = z.enum([
  "INVALID_COMMAND",
  "WRONG_MATCH",
  "WRONG_ROUND",
  "WRONG_TURN",
  "WRONG_PHASE",
  "DUPLICATE_SHOT",
  "ILLEGAL_HIT_POINT",
]);
export type CommandRejectionReason = z.infer<
  typeof CommandRejectionReasonSchema
>;

export type CommandResult =
  | { accepted: true }
  | { accepted: false; reason: CommandRejectionReason };

export const ContactKindSchema = z.enum([
  "SHARPENER_SHARPENER",
  "SHARPENER_TABLE",
  "SHARPENER_FLOOR",
]);
export type ContactKind = z.infer<typeof ContactKindSchema>;

export const BodySnapshotSchema = z.object({
  player: PlayerIndexSchema,
  position: Vec3Schema,
  rotation: QuaternionSchema,
  linearVelocity: Vec3Schema,
  angularVelocity: Vec3Schema,
  eliminated: z.boolean(),
  sleeping: z.boolean().optional(),
});
export type BodySnapshot = z.infer<typeof BodySnapshotSchema>;

export const GameSnapshotSchema = z.object({
  matchId: IdentifierSchema,
  tick: NonNegativeIntegerSchema,
  phase: MatchPhaseSchema,
  roundId: z.number().int().positive(),
  turnId: z.number().int().positive(),
  activePlayer: PlayerIndexSchema,
  aimingTicksRemaining: NonNegativeIntegerSchema,
  scores: z.tuple([NonNegativeIntegerSchema, NonNegativeIntegerSchema]),
  roundWinner: PlayerIndexSchema.nullable(),
  matchWinner: PlayerIndexSchema.nullable(),
  shotCount: NonNegativeIntegerSchema,
  sharpeners: z.tuple([BodySnapshotSchema, BodySnapshotSchema]),
});
export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;

export const GameEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SHOT_ACCEPTED"),
    player: PlayerIndexSchema,
    shotId: IdentifierSchema,
  }),
  z.object({
    type: z.literal("TURN_PASSED"),
    player: PlayerIndexSchema,
    reason: z.literal("TIMER_EXPIRED"),
  }),
  z.object({ type: z.literal("PHASE_CHANGED"), phase: MatchPhaseSchema }),
  z.object({
    type: z.literal("SHARPENER_ELIMINATED"),
    player: PlayerIndexSchema,
  }),
  z.object({ type: z.literal("FALL_STARTED"), player: PlayerIndexSchema }),
  z.object({
    type: z.literal("CONTACT"),
    kind: ContactKindSchema,
    player: PlayerIndexSchema,
    otherPlayer: PlayerIndexSchema.optional(),
    strength01: FiniteNumberSchema.min(0).max(1),
  }),
  z.object({
    type: z.literal("ROUND_ENDED"),
    roundId: z.number().int().positive(),
    winner: PlayerIndexSchema.nullable(),
    reason: z.enum(["KNOCKOUT", "DOUBLE_FALL", "SHOT_LIMIT", "SAFETY_LIMIT"]),
  }),
  z.object({
    type: z.literal("MATCH_ENDED"),
    winner: PlayerIndexSchema,
    reason: z.enum(["SCORE", "FORFEIT"]),
  }),
]);
export type GameEvent = z.infer<typeof GameEventSchema>;
