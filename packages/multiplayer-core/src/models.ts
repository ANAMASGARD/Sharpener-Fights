import type { GameCheckpoint } from "@sharpener/game-core";
import type {
  DeadlineKind,
  LobbyPlayer,
  MatchView,
  PlaybackState,
  ProvisioningStatus,
  RoomMode,
  RoomStatus,
  RuntimeVersions,
  ShotResolution,
} from "@sharpener/protocol";

export type Identity = {
  publicUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type AuthoritativeDeadline = {
  kind: DeadlineKind;
  endsAtMs: number;
  playerId?: string;
};

export type SeatController = {
  userId: string;
  clientInstanceId: string;
  connectionId: number;
  acquiredAtMs: number;
  expiresAtMs: number;
};

export type RoomRecord = {
  roomId: string;
  mode: RoomMode;
  provisioningStatus: ProvisioningStatus;
  status: RoomStatus;
  operationId: string;
  revision: number;
  versions: RuntimeVersions;
  players: LobbyPlayer[];
  checkpoint: GameCheckpoint;
  playbackState: PlaybackState;
  deadline: AuthoritativeDeadline | null;
  rematchVotes: Array<0 | 1>;
  history: ShotResolution[];
  pausedFromStatus?: RoomStatus;
  createdAtMs: number;
  updatedAtMs: number;
};

export type InviteRecord = {
  codeHash: string;
  operationId: string;
  roomId: string;
  hostUserId: string;
  hostDisplayName: string;
  hostAvatarUrl: string | null;
  expiresAtMs: number;
  state: "AVAILABLE" | "EXPIRED" | "CLAIMED" | "CANCELLED";
};

export type MatchmakingTicket = {
  ticketId: string;
  publicUserId: string;
  displayName: string;
  avatarUrl: string | null;
  cosmeticId: LobbyPlayer["cosmeticId"];
  versions: RuntimeVersions;
  regionPool: string;
  enteredAtMs: number;
  heartbeatExpiresAtMs: number;
};

export type PairingResult =
  | { status: "WAITING"; position: number }
  | { status: "MATCHED"; room: RoomRecord; seat: 0 | 1 };

export function roomToView(room: RoomRecord): MatchView {
  const deadline = room.deadline;
  return {
    roomId: room.roomId,
    mode: room.mode,
    status: room.status,
    revision: room.revision,
    players: room.players.map((player) => ({ ...player })),
    countdownEndsAtMs: deadline?.kind === "COUNTDOWN" ? deadline.endsAtMs : null,
    reconnectDeadlineMs: deadline?.kind === "RECONNECT" ? deadline.endsAtMs : null,
    turnDeadlineMs: deadline?.kind === "TURN" ? deadline.endsAtMs : null,
    rematchVotes: [...room.rematchVotes],
  };
}
