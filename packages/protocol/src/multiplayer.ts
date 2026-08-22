import { z } from "zod";
import {
  FiniteNumberSchema,
  IdentifierSchema,
  NonNegativeIntegerSchema,
  QuaternionSchema,
  Vec3Schema,
} from "./common";
import {
  GameEventSchema,
  MatchPhaseSchema,
  PlayerIndexSchema,
  SharpenerCosmeticIdSchema,
  ShotCommandSchema,
} from "./game";
import {
  EmoteIdSchema,
  LobbyPlayerSchema,
  RoomModeSchema,
  RoomStatusSchema,
} from "./room";
export const PROTOCOL_VERSION = 2;
export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);

export const GAME_VERSION = 1;
export const PHYSICS_VERSION = 1;
export const GameVersionSchema = z.literal(GAME_VERSION);
export const PhysicsVersionSchema = z.literal(PHYSICS_VERSION);

export const RuntimeVersionsSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  checkpointVersion: z.number().int().positive(),
  physicsVersion: PhysicsVersionSchema,
  clientBuildId: z.string().trim().min(1).max(128),
});
export type RuntimeVersions = z.infer<typeof RuntimeVersionsSchema>;

export const ProvisioningStatusSchema = z.enum([
  "PROVISIONING",
  "READY",
  "PROVISIONING_FAILED",
  "CLOSING",
  "CLOSED",
]);
export type ProvisioningStatus = z.infer<typeof ProvisioningStatusSchema>;

export const DeadlineKindSchema = z.enum([
  "COUNTDOWN",
  "TURN",
  "RECONNECT",
  "REMATCH",
]);
export type DeadlineKind = z.infer<typeof DeadlineKindSchema>;

export const MatchActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("READY"), requestId: IdentifierSchema }),
  z.object({
    type: z.literal("SHOT"),
    requestId: IdentifierSchema,
    command: ShotCommandSchema,
  }),
  z.object({
    type: z.literal("EMOTE"),
    requestId: IdentifierSchema,
    emoteId: EmoteIdSchema,
  }),
  z.object({ type: z.literal("REMATCH_VOTE"), requestId: IdentifierSchema }),
  z.object({ type: z.literal("LEAVE"), requestId: IdentifierSchema }),
  z.object({
    type: z.literal("ADVANCE_DEADLINE"),
    requestId: IdentifierSchema,
    expectedDeadlineKind: DeadlineKindSchema,
  }),
]);
export type MatchAction = z.infer<typeof MatchActionSchema>;

export const MatchActionRequestSchema = z.object({
  clientInstanceId: IdentifierSchema,
  connectionId: z.number().int().optional(),
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  clientBuildId: z.string().trim().min(1).max(128),
  action: MatchActionSchema,
});
export type MatchActionRequest = z.infer<typeof MatchActionRequestSchema>;

export const PlaybackFighterSchema = z.object({
  position: Vec3Schema,
  rotation: QuaternionSchema,
  linearVelocity: Vec3Schema,
  angularVelocity: Vec3Schema,
  eliminated: z.boolean(),
  sleeping: z.boolean().optional(),
});
export type PlaybackFighter = z.infer<typeof PlaybackFighterSchema>;

export const PlaybackStateSchema = z.object({
  tick: NonNegativeIntegerSchema,
  fighters: z.tuple([PlaybackFighterSchema, PlaybackFighterSchema]),
  phase: MatchPhaseSchema,
  activePlayer: PlayerIndexSchema,
  roundScore: z.tuple([NonNegativeIntegerSchema, NonNegativeIntegerSchema]),
  roundId: z.number().int().positive(),
  turnId: z.number().int().positive(),
  aimingTicksRemaining: NonNegativeIntegerSchema,
  roundWinner: PlayerIndexSchema.nullable(),
  matchWinner: PlayerIndexSchema.nullable(),
  shotCount: NonNegativeIntegerSchema,
});
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;

export const TimedGameEventSchema = z.object({
  tickOffset: NonNegativeIntegerSchema,
  event: GameEventSchema,
});
export type TimedGameEvent = z.infer<typeof TimedGameEventSchema>;

const StateHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const ShotResolutionSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  roomId: IdentifierSchema,
  revision: z.number().int().positive(),
  actionId: IdentifierSchema,
  player: PlayerIndexSchema,
  command: ShotCommandSchema,
  startState: PlaybackStateSchema,
  finalState: PlaybackStateSchema,
  durationTicks: NonNegativeIntegerSchema,
  timedEvents: z.array(TimedGameEventSchema).max(256),
  finalStateHash: StateHashSchema,
});
export type ShotResolution = z.infer<typeof ShotResolutionSchema>;

export const MatchViewSchema = z.object({
  roomId: IdentifierSchema,
  mode: RoomModeSchema,
  status: RoomStatusSchema,
  revision: NonNegativeIntegerSchema,
  players: z.array(LobbyPlayerSchema).max(2),
  countdownEndsAtMs: NonNegativeIntegerSchema.nullable(),
  reconnectDeadlineMs: NonNegativeIntegerSchema.nullable(),
  turnDeadlineMs: NonNegativeIntegerSchema.nullable(),
  rematchVotes: z.array(PlayerIndexSchema).max(2),
});
export type MatchView = z.infer<typeof MatchViewSchema>;

export const MatchUpdatedEventSchema = z.object({
  type: z.literal("MATCH_UPDATED"),
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  roomId: IdentifierSchema,
  revision: z.number().int().positive(),
  actionId: IdentifierSchema,
  finalStateHash: StateHashSchema,
  view: MatchViewSchema,
  resolution: ShotResolutionSchema.optional(),
});
export type MatchUpdatedEvent = z.infer<typeof MatchUpdatedEventSchema>;

export const MatchEmoteEventSchema = z.object({
  type: z.literal("MATCH_EMOTE"),
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  roomId: IdentifierSchema,
  actionId: IdentifierSchema,
  player: PlayerIndexSchema,
  emoteId: EmoteIdSchema,
  expiresAtMs: NonNegativeIntegerSchema,
});
export type MatchEmoteEvent = z.infer<typeof MatchEmoteEventSchema>;

export const MatchRealtimeEventSchema = z.discriminatedUnion("type", [
  MatchUpdatedEventSchema,
  MatchEmoteEventSchema,
]);
export type MatchRealtimeEvent = z.infer<typeof MatchRealtimeEventSchema>;

export const MatchRecoveryResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("DELTA"),
    currentRevision: NonNegativeIntegerSchema,
    view: MatchViewSchema,
    resolutions: z.array(ShotResolutionSchema).max(16),
  }),
  z.object({
    type: z.literal("FULL"),
    currentRevision: NonNegativeIntegerSchema,
    view: MatchViewSchema,
    playbackState: PlaybackStateSchema,
  }),
]);
export type MatchRecoveryResponse = z.infer<
  typeof MatchRecoveryResponseSchema
>;

export const MatchSessionResponseSchema = z.object({
  seat: PlayerIndexSchema,
  recovery: MatchRecoveryResponseSchema,
});
export type MatchSessionResponse = z.infer<typeof MatchSessionResponseSchema>;

export const FriendRoomCreateRequestSchema = z.object({
  operationId: IdentifierSchema,
  cosmeticId: SharpenerCosmeticIdSchema,
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  clientBuildId: z.string().trim().min(1).max(128),
});
export type FriendRoomCreateRequest = z.infer<
  typeof FriendRoomCreateRequestSchema
>;

export const FriendRoomCreateResponseSchema = z.object({
  roomId: IdentifierSchema,
  inviteCode: z.string().min(22).max(128),
  inviteUrl: z.string().url(),
  expiresAtMs: NonNegativeIntegerSchema,
});
export type FriendRoomCreateResponse = z.infer<
  typeof FriendRoomCreateResponseSchema
>;

export const InvitePreviewSchema = z.object({
  roomId: IdentifierSchema,
  hostDisplayName: z.string().trim().min(1).max(20),
  hostAvatarUrl: z.string().url().nullable(),
  expiresAtMs: NonNegativeIntegerSchema,
  state: z.enum(["AVAILABLE", "EXPIRED", "CLAIMED", "CANCELLED"]),
});
export type InvitePreview = z.infer<typeof InvitePreviewSchema>;

export const InviteClaimRequestSchema = z.object({
  operationId: IdentifierSchema,
  cosmeticId: SharpenerCosmeticIdSchema,
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  clientBuildId: z.string().trim().min(1).max(128),
});
export type InviteClaimRequest = z.infer<typeof InviteClaimRequestSchema>;

export const MatchAdmissionResponseSchema = z.object({
  roomId: IdentifierSchema,
  seat: PlayerIndexSchema,
  revision: NonNegativeIntegerSchema,
});
export type MatchAdmissionResponse = z.infer<
  typeof MatchAdmissionResponseSchema
>;

export const MatchmakingJoinRequestSchema = z.object({
  ticketId: IdentifierSchema,
  cosmeticId: SharpenerCosmeticIdSchema,
  protocolVersion: ProtocolVersionSchema,
  gameVersion: GameVersionSchema,
  clientBuildId: z.string().trim().min(1).max(128),
  regionPool: z.string().trim().min(1).max(32),
});
export type MatchmakingJoinRequest = z.infer<
  typeof MatchmakingJoinRequestSchema
>;

export const MatchmakingStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("WAITING"),
    ticketId: IdentifierSchema,
    position: z.number().int().positive(),
    retryAfterMs: z.number().int().min(500).max(3_000),
  }),
  z.object({
    status: z.literal("MATCHED"),
    ticketId: IdentifierSchema,
    roomId: IdentifierSchema,
    seat: PlayerIndexSchema,
  }),
]);
export type MatchmakingStatusResponse = z.infer<
  typeof MatchmakingStatusResponseSchema
>;

export const ControllerRequestSchema = z.object({
  requestId: IdentifierSchema,
  clientInstanceId: IdentifierSchema,
  connectionId: z.number().int(),
  force: z.boolean().default(false),
});
export type ControllerRequest = z.infer<typeof ControllerRequestSchema>;

export const ControllerResponseSchema = z.object({
  mode: z.enum(["ACTIVE", "PASSIVE"]),
  leaseExpiresAtMs: NonNegativeIntegerSchema.nullable(),
  view: MatchViewSchema.optional(),
});
export type ControllerResponse = z.infer<typeof ControllerResponseSchema>;

export const MatchActionResponseSchema = z.object({
  actionId: IdentifierSchema,
  revision: NonNegativeIntegerSchema,
  view: MatchViewSchema,
  playbackState: PlaybackStateSchema,
  resolution: ShotResolutionSchema.optional(),
  replayed: z.boolean(),
});
export type MatchActionResponse = z.infer<typeof MatchActionResponseSchema>;

export const RateLimitStateSchema = z.object({
  limit: z.number().int().positive(),
  remaining: NonNegativeIntegerSchema,
  resetAtMs: NonNegativeIntegerSchema,
});
export type RateLimitState = z.infer<typeof RateLimitStateSchema>;

export const ResolverMetricsSchema = z.object({
  durationMs: FiniteNumberSchema.nonnegative(),
  ticks: NonNegativeIntegerSchema,
  resolutionBytes: NonNegativeIntegerSchema,
});
export type ResolverMetrics = z.infer<typeof ResolverMetricsSchema>;
