import { z } from "zod";
import {
  CommandRejectionReasonSchema,
  GameEventSchema,
  GameSnapshotSchema,
  ShotCommandSchema,
} from "./game";

export const LocalWorkerRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SHOT"), command: ShotCommandSchema }),
  z.object({ type: z.literal("RESET") }),
]);
export type LocalWorkerRequest = z.infer<typeof LocalWorkerRequestSchema>;

export const LocalWorkerResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("READY"), snapshot: GameSnapshotSchema }),
  z.object({
    type: z.literal("SNAPSHOT"),
    snapshot: GameSnapshotSchema,
    events: z.array(GameEventSchema),
  }),
  z.object({
    type: z.literal("COMMAND_ACCEPTED"),
    shotId: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("COMMAND_REJECTED"),
    reason: CommandRejectionReasonSchema,
  }),
  z.object({ type: z.literal("ERROR"), message: z.string().min(1).max(512) }),
]);
export type LocalWorkerResponse = z.infer<typeof LocalWorkerResponseSchema>;
