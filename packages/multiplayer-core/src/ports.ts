import type {
  EmoteId,
  MatchActionResponse,
  MatchUpdatedEvent,
  MatchmakingStatusResponse,
  ShotResolution,
} from "@sharpener/protocol";
import type {
  InviteRecord,
  MatchmakingTicket,
  PairingResult,
  RoomRecord,
  SeatController,
} from "./models";

export type CommitRoomInput = {
  roomId: string;
  lockToken: string;
  expectedRevision: number;
  requestId: string;
  nextRoom: RoomRecord;
  response: MatchActionResponse;
  resolution?: ShotResolution;
};

export type CommitRoomResult =
  | { status: "COMMITTED"; response: MatchActionResponse }
  | { status: "REPLAYED"; response: MatchActionResponse }
  | { status: "LOCK_LOST" }
  | { status: "STALE_REVISION" };

export type PauseRoomResult = "PAUSED" | "LOCK_LOST" | "STALE_REVISION";

export interface AuthorityStore {
  now(): Promise<number>;
  createFriendRoom(room: RoomRecord, invite: InviteRecord): Promise<RoomRecord>;
  markProvisioning(roomId: string, status: RoomRecord["provisioningStatus"]): Promise<void>;
  findInvite(codeHash: string): Promise<InviteRecord | null>;
  claimInvite(input: {
    codeHash: string;
    operationId: string;
    player: RoomRecord["players"][number];
  }): Promise<{ room: RoomRecord; seat: 1 } | null>;
  getRoom(roomId: string): Promise<RoomRecord | null>;
  acquireRoomLock(roomId: string, token: string, ttlMs: number): Promise<boolean>;
  releaseRoomLock(roomId: string, token: string): Promise<void>;
  commitRoom(input: CommitRoomInput): Promise<CommitRoomResult>;
  pauseRoomForResolverError(input: {
    roomId: string;
    lockToken: string;
    expectedRevision: number;
    nowMs: number;
  }): Promise<PauseRoomResult>;
  getIdempotentResponse(roomId: string, requestId: string): Promise<MatchActionResponse | null>;
  enqueueAndPair(ticket: MatchmakingTicket, room: RoomRecord): Promise<PairingResult>;
  getTicketStatus(
    ticketId: string,
    publicUserId: string,
    regionPool: string,
    gameVersion: number,
    heartbeatExpiresAtMs: number,
  ): Promise<MatchmakingStatusResponse | null>;
  cancelTicket(ticketId: string, publicUserId: string, regionPool: string, gameVersion: number): Promise<void>;
  acquireController(input: {
    roomId: string;
    seat: 0 | 1;
    controller: SeatController;
    force: boolean;
  }): Promise<"ACTIVE" | "PASSIVE">;
  getController(roomId: string, seat: 0 | 1): Promise<SeatController | null>;
  pauseForDisconnect(input: {
    eventId: string;
    roomId: string;
    publicUserId: string;
    connectionId: number;
    nowMs: number;
    reconnectEndsAtMs: number;
  }): Promise<RoomRecord | null>;
  resumeAfterReconnect(roomId: string, publicUserId: string, nowMs: number): Promise<RoomRecord | null>;
}

export interface RealtimePublisher {
  ensureRoom(roomId: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  publish(event: MatchUpdatedEvent): Promise<void>;
  publishEmote(input: {
    roomId: string;
    actionId: string;
    player: 0 | 1;
    emoteId: EmoteId;
    expiresAtMs: number;
  }): Promise<void>;
}

export interface PresenceReader {
  isConnectionActive(roomId: string, connectionId: number): Promise<boolean>;
  hasActiveUser(roomId: string, publicUserId: string): Promise<boolean>;
}

export interface IdGenerator {
  id(prefix: string): string;
  inviteCode(operationId: string): string;
}

export interface SecretHasher {
  hash(value: string): string;
}
