import { z } from "zod";
import { IdentifierSchema } from "./common";
import { PlayerIndexSchema, SharpenerCosmeticIdSchema } from "./game";

export const RoomModeSchema = z.enum(["FRIEND", "INSTANT"]);
export type RoomMode = z.infer<typeof RoomModeSchema>;

export const RoomStatusSchema = z.enum([
  "WAITING",
  "COUNTDOWN",
  "PLAYING",
  "PAUSED_RECONNECT",
  "PAUSED_ERROR",
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
