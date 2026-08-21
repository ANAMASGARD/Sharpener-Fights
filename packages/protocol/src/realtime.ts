import { z } from "zod";
import { IdentifierSchema, NonNegativeIntegerSchema } from "./common";
import {
  GameEventSchema,
  GameSnapshotSchema,
  PlayerIndexSchema,
  SharpenerCosmeticIdSchema,
  ShotCommandSchema,
} from "./game";
import { EmoteIdSchema, InviteMetadataSchema, RoomModeSchema } from "./room";

export const PROTOCOL_VERSION = 1;
export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);

const VersionedJoinOptionsSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  buildId: z.string().min(1).max(128),
  cosmeticId: SharpenerCosmeticIdSchema,
});

export const FightRoomJoinOptionsSchema = VersionedJoinOptionsSchema.extend({
  mode: RoomModeSchema,
  inviteCode: z.string().min(22).max(128).optional(),
});
export type FightRoomJoinOptions = z.infer<
  typeof FightRoomJoinOptionsSchema
>;

export const InstantQueueJoinOptionsSchema = VersionedJoinOptionsSchema;
export type InstantQueueJoinOptions = z.infer<
  typeof InstantQueueJoinOptionsSchema
>;

export const ClientRealtimeMessageSchema = z.discriminatedUnion("type", [
  ShotCommandSchema,
  z.object({ type: z.literal("SYNC_REQUEST") }),
  z.object({ type: z.literal("READY") }),
  z.object({ type: z.literal("EMOTE"), emoteId: EmoteIdSchema }),
  z.object({ type: z.literal("REMATCH_VOTE") }),
  z.object({ type: z.literal("LEAVE") }),
]);
export type ClientRealtimeMessage = z.infer<
  typeof ClientRealtimeMessageSchema
>;

export const RealtimeErrorCodeSchema = z.enum([
  "UPDATE_REQUIRED",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "INVALID_MESSAGE",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_CLOSED",
  "COSMETIC_UNAVAILABLE",
  "SERVER_OVERLOADED",
]);
export type RealtimeErrorCode = z.infer<typeof RealtimeErrorCodeSchema>;

export const ServerRealtimeMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SEAT_ASSIGNED"), seat: PlayerIndexSchema }),
  z.object({ type: z.literal("INVITE_CREATED"), invite: InviteMetadataSchema }),
  z.object({
    type: z.literal("QUEUE_STATUS"),
    position: z.number().int().positive(),
  }),
  z.object({ type: z.literal("MATCH_FOUND"), roomId: IdentifierSchema }),
  z.object({
    type: z.literal("GAME_FRAME"),
    protocolVersion: ProtocolVersionSchema,
    roomId: IdentifierSchema,
    frameSeq: NonNegativeIntegerSchema,
    serverTick: NonNegativeIntegerSchema,
    snapshot: GameSnapshotSchema,
    events: z.array(GameEventSchema),
  }),
  z.object({
    type: z.literal("SHOT_ACCEPTED"),
    player: PlayerIndexSchema,
    serverTick: NonNegativeIntegerSchema,
    command: ShotCommandSchema,
  }),
  z.object({
    type: z.literal("EMOTE_SHOWN"),
    player: PlayerIndexSchema,
    emoteId: EmoteIdSchema,
    expiresAtMs: NonNegativeIntegerSchema,
  }),
  z.object({
    type: z.literal("ERROR"),
    code: RealtimeErrorCodeSchema,
    message: z.string().min(1).max(512),
  }),
]);
export type ServerRealtimeMessage = z.infer<
  typeof ServerRealtimeMessageSchema
>;
