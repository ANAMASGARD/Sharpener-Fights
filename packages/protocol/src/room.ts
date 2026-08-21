import { z } from "zod";
import { IdentifierSchema, NonNegativeIntegerSchema } from "./common";
import { PlayerIndexSchema, SharpenerCosmeticIdSchema } from "./game";

export const RoomModeSchema = z.enum(["FRIEND", "INSTANT"]);
export type RoomMode = z.infer<typeof RoomModeSchema>;

export const RoomStatusSchema = z.enum([
  "WAITING",
  "COUNTDOWN",
  "PLAYING",
  "PAUSED_RECONNECT",
  "MATCH_OVER",
  "CLOSED",
]);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const EmoteIdSchema = z.enum([
  "NICE_SHOT",
  "OOPS",
  "WOW",
  "SO_CLOSE",
  "GOOD_LUCK",
  "GOOD_GAME",
]);
export type EmoteId = z.infer<typeof EmoteIdSchema>;

export const LobbyPlayerSchema = z.object({
  playerId: IdentifierSchema,
  displayName: z.string().trim().min(1).max(20),
  avatarUrl: z.string().url().nullable(),
  seat: PlayerIndexSchema,
  cosmeticId: SharpenerCosmeticIdSchema,
  ready: z.boolean(),
  connected: z.boolean(),
});
export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;

export const LobbyMetadataSchema = z.object({
  roomId: IdentifierSchema,
  mode: RoomModeSchema,
  status: RoomStatusSchema,
  players: z.array(LobbyPlayerSchema).max(2),
  countdownEndsAtMs: NonNegativeIntegerSchema.nullable(),
  reconnectDeadlineMs: NonNegativeIntegerSchema.nullable(),
  rematchVotes: z.array(PlayerIndexSchema).max(2),
});
export type LobbyMetadata = z.infer<typeof LobbyMetadataSchema>;

export const InviteStateSchema = z.enum([
  "AVAILABLE",
  "EXPIRED",
  "FULL",
  "STARTED",
  "CANCELLED",
]);
export type InviteState = z.infer<typeof InviteStateSchema>;

export const InviteMetadataSchema = z.object({
  code: z.string().min(22).max(128),
  roomId: IdentifierSchema,
  hostDisplayName: z.string().trim().min(1).max(20),
  hostAvatarUrl: z.string().url().nullable(),
  expiresAtMs: NonNegativeIntegerSchema,
  state: InviteStateSchema,
});
export type InviteMetadata = z.infer<typeof InviteMetadataSchema>;
