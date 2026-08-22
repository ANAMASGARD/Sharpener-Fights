import type {
  MatchActionResponse,
  MatchmakingStatusResponse,
} from "@sharpener/protocol";
import type {
  AuthorityStore,
  CommitRoomInput,
  CommitRoomResult,
} from "../ports";
import type {
  InviteRecord,
  MatchmakingTicket,
  PairingResult,
  RoomRecord,
  SeatController,
} from "../models";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryAuthorityStore implements AuthorityStore {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly roomByOperation = new Map<string, string>();
  private readonly invites = new Map<string, InviteRecord>();
  private readonly inviteClaims = new Map<string, string>();
  private readonly locks = new Map<string, { token: string; expiresAtMs: number }>();
  private readonly idempotency = new Map<string, MatchActionResponse>();
  private readonly tickets = new Map<string, MatchmakingTicket>();
  private readonly queue: string[] = [];
  private readonly ticketResults = new Map<string, MatchmakingStatusResponse>();
  private readonly controllers = new Map<string, SeatController>();
  private readonly webhookEvents = new Set<string>();
  private readonly clock: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.clock = options.now ?? Date.now;
  }

  async now() {
    return this.clock();
  }

  async createFriendRoom(room: RoomRecord, invite: InviteRecord) {
    const operationKey = `${invite.hostUserId}:${room.operationId}`;
    const existingId = this.roomByOperation.get(operationKey);
    if (existingId) return clone(this.rooms.get(existingId)!);
    this.rooms.set(room.roomId, clone(room));
    this.roomByOperation.set(operationKey, room.roomId);
    this.invites.set(invite.codeHash, clone(invite));
    return clone(room);
  }

  async markProvisioning(roomId: string, status: RoomRecord["provisioningStatus"]) {
    const room = this.rooms.get(roomId);
    if (room && !(room.provisioningStatus === "READY" && status === "PROVISIONING_FAILED")) {
      room.provisioningStatus = status;
    }
  }

  async findInvite(codeHash: string) {
    const invite = this.invites.get(codeHash);
    if (!invite) return null;
    if (invite.state === "AVAILABLE" && invite.expiresAtMs <= this.clock()) {
      invite.state = "EXPIRED";
    }
    return clone(invite);
  }

  async claimInvite(input: {
    codeHash: string;
    operationId: string;
    player: RoomRecord["players"][number];
  }) {
    const claimKey = `${input.player.playerId}:${input.operationId}`;
    const replayRoom = this.inviteClaims.get(claimKey);
    if (replayRoom) return { room: clone(this.rooms.get(replayRoom)!), seat: 1 as const };
    const invite = await this.findInvite(input.codeHash);
    if (!invite || invite.state !== "AVAILABLE") return null;
    const room = this.rooms.get(invite.roomId);
    if (!room || room.players.length !== 1 || room.provisioningStatus !== "READY") return null;
    room.players.push(clone(input.player));
    room.updatedAtMs = this.clock();
    invite.state = "CLAIMED";
    this.invites.set(input.codeHash, invite);
    this.inviteClaims.set(claimKey, room.roomId);
    return { room: clone(room), seat: 1 as const };
  }

  async getRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    return room ? clone(room) : null;
  }

  async seedRoom(room: RoomRecord) {
    this.rooms.set(room.roomId, clone(room));
    return clone(room);
  }

  async acquireRoomLock(roomId: string, token: string, ttlMs: number) {
    const current = this.locks.get(roomId);
    if (current && current.expiresAtMs > this.clock()) return false;
    this.locks.set(roomId, { token, expiresAtMs: this.clock() + ttlMs });
    return true;
  }

  async releaseRoomLock(roomId: string, token: string) {
    if (this.locks.get(roomId)?.token === token) this.locks.delete(roomId);
  }

  async commitRoom(input: CommitRoomInput): Promise<CommitRoomResult> {
    const replay = this.idempotency.get(`${input.roomId}:${input.requestId}`);
    if (replay) return { status: "REPLAYED", response: clone(replay) };
    if (this.locks.get(input.roomId)?.token !== input.lockToken) {
      return { status: "LOCK_LOST" };
    }
    const current = this.rooms.get(input.roomId);
    if (!current || current.revision !== input.expectedRevision) {
      return { status: "STALE_REVISION" };
    }
    const next = clone(input.nextRoom);
    if (input.resolution) next.history = [...current.history, clone(input.resolution)].slice(-16);
    this.rooms.set(input.roomId, next);
    this.idempotency.set(`${input.roomId}:${input.requestId}`, clone(input.response));
    this.locks.delete(input.roomId);
    return { status: "COMMITTED", response: clone(input.response) };
  }

  async pauseRoomForResolverError(input: {
    roomId: string;
    lockToken: string;
    expectedRevision: number;
    nowMs: number;
  }) {
    if (this.locks.get(input.roomId)?.token !== input.lockToken) return "LOCK_LOST" as const;
    const room = this.rooms.get(input.roomId);
    if (!room || room.revision !== input.expectedRevision) return "STALE_REVISION" as const;
    room.status = "PAUSED_ERROR";
    room.deadline = null;
    room.revision += 1;
    room.updatedAtMs = input.nowMs;
    this.locks.delete(input.roomId);
    return "PAUSED" as const;
  }

  async getIdempotentResponse(roomId: string, requestId: string) {
    const response = this.idempotency.get(`${roomId}:${requestId}`);
    return response ? clone(response) : null;
  }

  async enqueueAndPair(ticket: MatchmakingTicket, room: RoomRecord): Promise<PairingResult> {
    const existing = this.ticketResults.get(ticket.ticketId);
    if (existing?.status === "MATCHED") {
      return {
        status: "MATCHED",
        room: clone(this.rooms.get(existing.roomId)!),
        seat: existing.seat,
      };
    }
    if (!this.tickets.has(ticket.ticketId)) {
      for (const [ticketId, queued] of this.tickets) {
        if (queued.publicUserId === ticket.publicUserId) {
          ticket.enteredAtMs = queued.enteredAtMs;
          this.tickets.delete(ticketId);
          this.ticketResults.delete(ticketId);
          const oldIndex = this.queue.indexOf(ticketId);
          if (oldIndex >= 0) this.queue.splice(oldIndex, 1);
          break;
        }
      }
      this.tickets.set(ticket.ticketId, clone(ticket));
      this.queue.push(ticket.ticketId);
    }
    while (this.queue.length > 0) {
      const queued = this.tickets.get(this.queue[0]);
      if (queued && queued.heartbeatExpiresAtMs > this.clock()) break;
      const staleId = this.queue.shift();
      if (staleId) this.tickets.delete(staleId);
    }
    const opponentId = this.queue.find((candidateId) => {
      const candidate = this.tickets.get(candidateId);
      return Boolean(
        candidate &&
          candidate.ticketId !== ticket.ticketId &&
          candidate.publicUserId !== ticket.publicUserId &&
          candidate.versions.gameVersion === ticket.versions.gameVersion &&
          candidate.regionPool === ticket.regionPool,
      );
    });
    if (!opponentId) {
      const position = this.queue.indexOf(ticket.ticketId) + 1;
      const waiting = {
        status: "WAITING" as const,
        ticketId: ticket.ticketId,
        position: Math.max(1, position),
        retryAfterMs: 500,
      };
      this.ticketResults.set(ticket.ticketId, waiting);
      return { status: "WAITING", position: waiting.position };
    }
    const opponent = this.tickets.get(opponentId)!;
    const ordered = [opponent, ticket].sort((left, right) => left.enteredAtMs - right.enteredAtMs);
    const cosmetic0 = ordered[0].cosmeticId;
    const cosmetic1 = ordered[1].cosmeticId === cosmetic0
      ? cosmetic0 === "ocean-blue" ? "ember-red" : "ocean-blue"
      : ordered[1].cosmeticId;
    room.players = ordered.map((player, seat) => ({
      playerId: player.publicUserId,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      seat: seat as 0 | 1,
      cosmeticId: seat === 0 ? cosmetic0 : cosmetic1,
      ready: false,
      connected: true,
    }));
    this.rooms.set(room.roomId, clone(room));
    this.roomByOperation.set(room.operationId, room.roomId);
    for (const player of ordered) {
      const seat = player.publicUserId === ordered[0].publicUserId ? 0 : 1;
      this.ticketResults.set(player.ticketId, {
        status: "MATCHED",
        ticketId: player.ticketId,
        roomId: room.roomId,
        seat,
      });
      this.tickets.delete(player.ticketId);
      const index = this.queue.indexOf(player.ticketId);
      if (index >= 0) this.queue.splice(index, 1);
    }
    return {
      status: "MATCHED",
      room: clone(room),
      seat: ordered[0].publicUserId === ticket.publicUserId ? 0 : 1,
    };
  }

  async getTicketStatus(
    ticketId: string,
    publicUserId: string,
    _regionPool: string,
    _gameVersion: number,
    heartbeatExpiresAtMs: number,
  ) {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      if (ticket.publicUserId !== publicUserId) return null;
      ticket.heartbeatExpiresAtMs = heartbeatExpiresAtMs;
    }
    const status = this.ticketResults.get(ticketId);
    return status ? clone(status) : null;
  }

  async cancelTicket(ticketId: string, publicUserId: string, _regionPool: string, _gameVersion: number) {
    if (this.tickets.get(ticketId)?.publicUserId !== publicUserId) return;
    this.tickets.delete(ticketId);
    this.ticketResults.delete(ticketId);
    const index = this.queue.indexOf(ticketId);
    if (index >= 0) this.queue.splice(index, 1);
  }

  async acquireController(input: {
    roomId: string;
    seat: 0 | 1;
    controller: SeatController;
    force: boolean;
  }) {
    const room = this.rooms.get(input.roomId);
    if (!room) return "PASSIVE" as const;
    const key = `${input.roomId}:${input.seat}`;
    const current = this.controllers.get(key);
    if (
      current &&
      current.expiresAtMs > this.clock() &&
      current.clientInstanceId !== input.controller.clientInstanceId &&
      !input.force
    ) {
      return "PASSIVE" as const;
    }
    this.controllers.set(key, clone(input.controller));
    return "ACTIVE" as const;
  }

  async getController(roomId: string, seat: 0 | 1) {
    const controller = this.controllers.get(`${roomId}:${seat}`);
    return controller ? clone(controller) : null;
  }

  async pauseForDisconnect(input: {
    eventId: string;
    roomId: string;
    publicUserId: string;
    connectionId: number;
    nowMs: number;
    reconnectEndsAtMs: number;
  }) {
    if (this.webhookEvents.has(input.eventId)) return null;
    this.webhookEvents.add(input.eventId);
    const room = this.rooms.get(input.roomId);
    const player = room?.players.find((candidate) => candidate.playerId === input.publicUserId);
    const controller = player ? await this.getController(input.roomId, player.seat) : null;
    if (!room || !player || controller?.connectionId !== input.connectionId) return null;
    room.pausedFromStatus = room.status;
    room.status = "PAUSED_RECONNECT";
    room.deadline = { kind: "RECONNECT", endsAtMs: input.reconnectEndsAtMs, playerId: input.publicUserId };
    player.connected = false;
    room.revision += 1;
    room.updatedAtMs = input.nowMs;
    return clone(room);
  }

  async resumeAfterReconnect(roomId: string, publicUserId: string, nowMs: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== "PAUSED_RECONNECT" || room.deadline?.playerId !== publicUserId) return null;
    const player = room.players.find((candidate) => candidate.playerId === publicUserId);
    if (!player) return null;
    player.connected = true;
    room.status = room.pausedFromStatus ?? "PLAYING";
    delete room.pausedFromStatus;
    room.deadline = room.status === "PLAYING"
      ? { kind: "TURN", endsAtMs: nowMs + 15_000 }
      : room.status === "COUNTDOWN"
        ? { kind: "COUNTDOWN", endsAtMs: nowMs + 3_000 }
        : null;
    room.revision += 1;
    room.updatedAtMs = nowMs;
    return clone(room);
  }

  async debug() {
    return {
      rooms: [...this.rooms.values()].map(clone),
      invites: [...this.invites.values()].map(clone),
    };
  }
}
