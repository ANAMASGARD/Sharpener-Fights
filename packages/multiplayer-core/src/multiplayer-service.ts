import {
  CHECKPOINT_VERSION,
  PHYSICS,
  TICKS_PER_SECOND,
  createGameSimulation,
  createGameSimulationFromCheckpoint,
} from "@sharpener/game-core";
import {
  GAME_VERSION,
  PHYSICS_VERSION,
  PROTOCOL_VERSION,
  type FriendRoomCreateResponse,
  type EmoteId,
  type MatchAction,
  type MatchActionResponse,
  type MatchRecoveryResponse,
  type MatchSessionResponse,
  type MatchmakingStatusResponse,
  type MatchUpdatedEvent,
  type RuntimeVersions,
  type SharpenerCosmeticId,
  type ShotResolution,
  type TimedGameEvent,
} from "@sharpener/protocol";
import { MultiplayerError } from "./errors";
import type { Identity, RoomRecord } from "./models";
import { roomToView } from "./models";
import { hashPlaybackState, snapshotToPlayback } from "./playback";
import type {
  AuthorityStore,
  IdGenerator,
  PresenceReader,
  RealtimePublisher,
  SecretHasher,
} from "./ports";

const INVITE_TTL_MS = 15 * 60_000;
const COUNTDOWN_MS = 3_000;
const TURN_MS = 15_000;
const LOCK_TTL_MS = 8_000;
const MAX_SIMULATION_TICKS = 20 * TICKS_PER_SECOND;
const MAX_TIMED_EVENTS = 256;
const MAX_RESOLUTION_BYTES = 128 * 1024;
const MAX_RESOLVER_CPU_MS = 2_000;

type Dependencies = {
  store: AuthorityStore;
  realtime: RealtimePublisher;
  ids: IdGenerator;
  hasher: SecretHasher;
  presence: PresenceReader;
};

type CreateFriendInput = {
  identity: Identity;
  operationId: string;
  cosmeticId: SharpenerCosmeticId;
  versions: RuntimeVersions;
  origin: string;
};

type ActionExecution = {
  response: MatchActionResponse;
  event?: MatchUpdatedEvent;
  emote?: { player: 0 | 1; emoteId: EmoteId; expiresAtMs: number };
};

export function createMultiplayerService(dependencies: Dependencies) {
  return new MultiplayerService(dependencies);
}

class MultiplayerService {
  constructor(private readonly dependencies: Dependencies) {}

  async createFriendRoom(input: CreateFriendInput): Promise<FriendRoomCreateResponse> {
    this.assertVersions(input.versions);
    const now = await this.dependencies.store.now();
    const roomId = this.dependencies.ids.id("room");
    const inviteCode = this.dependencies.ids.inviteCode(
      `${input.identity.publicUserId}:${input.operationId}`,
    );
    const simulation = await createGameSimulation({ matchId: roomId });
    const room: RoomRecord = {
      roomId,
      mode: "FRIEND",
      provisioningStatus: "PROVISIONING",
      status: "WAITING",
      operationId: input.operationId,
      revision: 0,
      versions: input.versions,
      players: [this.player(input.identity, 0, input.cosmeticId)],
      checkpoint: simulation.createCheckpoint(),
      playbackState: snapshotToPlayback(simulation.getSnapshot()),
      deadline: null,
      rematchVotes: [],
      history: [],
      createdAtMs: now,
      updatedAtMs: now,
    };
    simulation.dispose();
    const stored = await this.dependencies.store.createFriendRoom(room, {
      codeHash: this.dependencies.hasher.hash(inviteCode),
      operationId: input.operationId,
      roomId,
      hostUserId: input.identity.publicUserId,
      hostDisplayName: input.identity.displayName.slice(0, 20),
      hostAvatarUrl: input.identity.avatarUrl,
      expiresAtMs: now + INVITE_TTL_MS,
      state: "AVAILABLE",
    });
    try {
      await this.dependencies.realtime.ensureRoom(stored.roomId);
      await this.dependencies.store.markProvisioning(stored.roomId, "READY");
    } catch (error) {
      await this.dependencies.store.markProvisioning(stored.roomId, "PROVISIONING_FAILED");
      throw error;
    }
    const authoritativeInvite = await this.dependencies.store.findInvite(
      this.dependencies.hasher.hash(inviteCode),
    );
    return {
      roomId: stored.roomId,
      inviteCode,
      inviteUrl: `${input.origin}/invite/${encodeURIComponent(inviteCode)}`,
      expiresAtMs: authoritativeInvite?.expiresAtMs ?? now + INVITE_TTL_MS,
    };
  }

  async previewInvite(inviteCode: string) {
    const invite = await this.dependencies.store.findInvite(
      this.dependencies.hasher.hash(inviteCode),
    );
    if (!invite) throw new MultiplayerError("INVITE_UNAVAILABLE", "This invitation is unavailable.");
    return {
      roomId: invite.roomId,
      hostDisplayName: invite.hostDisplayName,
      hostAvatarUrl: invite.hostAvatarUrl,
      expiresAtMs: invite.expiresAtMs,
      state: invite.state,
    };
  }

  async claimInvite(input: {
    identity: Identity;
    operationId: string;
    inviteCode: string;
    cosmeticId: SharpenerCosmeticId;
    versions: RuntimeVersions;
  }) {
    this.assertVersions(input.versions);
    const claimed = await this.dependencies.store.claimInvite({
      codeHash: this.dependencies.hasher.hash(input.inviteCode),
      operationId: input.operationId,
      player: this.player(input.identity, 1, input.cosmeticId),
    });
    if (!claimed) {
      throw new MultiplayerError("INVITE_UNAVAILABLE", "This invitation has expired or was already used.");
    }
    return { roomId: claimed.room.roomId, seat: 1 as const, revision: claimed.room.revision };
  }

  async getSession(identity: Identity, roomId: string, afterRevision: number): Promise<MatchSessionResponse> {
    const room = await this.requiredRoom(roomId);
    const seat = this.memberSeat(room, identity.publicUserId);
    return { seat, recovery: await this.recover(roomId, afterRevision) };
  }

  async joinMatchmaking(input: {
    identity: Identity;
    ticketId: string;
    cosmeticId: SharpenerCosmeticId;
    regionPool: string;
    versions: RuntimeVersions;
  }): Promise<MatchmakingStatusResponse> {
    this.assertVersions(input.versions);
    const now = await this.dependencies.store.now();
    const roomId = this.dependencies.ids.id("room");
    const simulation = await createGameSimulation({ matchId: roomId });
    const room: RoomRecord = {
      roomId,
      mode: "INSTANT",
      provisioningStatus: "PROVISIONING",
      status: "WAITING",
      operationId: `pair-${input.ticketId}`,
      revision: 0,
      versions: input.versions,
      players: [],
      checkpoint: simulation.createCheckpoint(),
      playbackState: snapshotToPlayback(simulation.getSnapshot()),
      deadline: null,
      rematchVotes: [],
      history: [],
      createdAtMs: now,
      updatedAtMs: now,
    };
    simulation.dispose();
    const pairing = await this.dependencies.store.enqueueAndPair({
      ticketId: input.ticketId,
      publicUserId: input.identity.publicUserId,
      displayName: input.identity.displayName.slice(0, 20),
      avatarUrl: input.identity.avatarUrl,
      cosmeticId: input.cosmeticId,
      versions: input.versions,
      regionPool: input.regionPool,
      enteredAtMs: now,
      heartbeatExpiresAtMs: now + 15_000,
    }, room);
    if (pairing.status === "WAITING") {
      return { status: "WAITING", ticketId: input.ticketId, position: pairing.position, retryAfterMs: 500 };
    }
    try {
      await this.dependencies.realtime.ensureRoom(pairing.room.roomId);
      await this.dependencies.store.markProvisioning(pairing.room.roomId, "READY");
    } catch (error) {
      await this.dependencies.store.markProvisioning(pairing.room.roomId, "PROVISIONING_FAILED");
      throw error;
    }
    return { status: "MATCHED", ticketId: input.ticketId, roomId: pairing.room.roomId, seat: pairing.seat };
  }

  async matchmakingStatus(identity: Identity, ticketId: string, regionPool: string) {
    const now = await this.dependencies.store.now();
    const status = await this.dependencies.store.getTicketStatus(
      ticketId,
      identity.publicUserId,
      regionPool,
      GAME_VERSION,
      now + 15_000,
    );
    if (!status) throw new MultiplayerError("ROOM_NOT_FOUND", "This queue ticket is no longer active.");
    if (status.status === "MATCHED") {
      const room = await this.dependencies.store.getRoom(status.roomId);
      if (!room) throw new MultiplayerError("ROOM_NOT_FOUND", "This matched desk no longer exists.");
      this.memberSeat(room, identity.publicUserId);
      if (room.provisioningStatus !== "READY") {
        try {
          await this.dependencies.realtime.ensureRoom(room.roomId);
          await this.dependencies.store.markProvisioning(room.roomId, "READY");
        } catch {
          await this.dependencies.store.markProvisioning(room.roomId, "PROVISIONING_FAILED");
          throw new MultiplayerError("ROOM_NOT_READY", "The realtime desk is still being prepared.");
        }
      }
    }
    return status;
  }

  async cancelMatchmaking(identity: Identity, ticketId: string, regionPool: string) {
    await this.dependencies.store.cancelTicket(ticketId, identity.publicUserId, regionPool, GAME_VERSION);
  }

  async claimController(input: {
    identity: Identity;
    roomId: string;
    clientInstanceId: string;
    connectionId: number;
    force: boolean;
  }) {
    const room = await this.requiredRoom(input.roomId);
    const seat = this.memberSeat(room, input.identity.publicUserId);
    const now = await this.dependencies.store.now();
    const mode = await this.dependencies.store.acquireController({
      roomId: input.roomId,
      seat,
      controller: {
        userId: input.identity.publicUserId,
        clientInstanceId: input.clientInstanceId,
        connectionId: input.connectionId,
        acquiredAtMs: now,
        expiresAtMs: now + 30_000,
      },
      force: input.force,
    });
    const resumed = mode === "ACTIVE"
      ? await this.dependencies.store.resumeAfterReconnect(input.roomId, input.identity.publicUserId, now)
      : null;
    const event = resumed ? this.eventForRoom(resumed, this.dependencies.ids.id("reconnect")) : undefined;
    return {
      mode,
      leaseExpiresAtMs: mode === "ACTIVE" ? now + 30_000 : null,
      ...(resumed ? { view: roomToView(resumed) } : {}),
      ...(event ? { event } : {}),
    } as const;
  }

  async handleConnectionLeft(input: {
    eventId: string;
    roomId: string;
    publicUserId: string;
    connectionId: number;
  }) {
    if (await this.dependencies.presence.isConnectionActive(input.roomId, input.connectionId)) return null;
    const now = await this.dependencies.store.now();
    const room = await this.dependencies.store.pauseForDisconnect({
      ...input,
      nowMs: now,
      reconnectEndsAtMs: now + 30_000,
    });
    return room ? this.eventForRoom(room, `presence-${input.eventId}`) : null;
  }

  async executeAction(input: {
    identity: Identity;
    roomId: string;
    clientInstanceId: string;
    connectionId?: number;
    action: MatchAction;
    versions: RuntimeVersions;
  }): Promise<ActionExecution> {
    this.assertVersions(input.versions);
    const firstRead = await this.requiredRoom(input.roomId);
    const seat = this.memberSeat(firstRead, input.identity.publicUserId);
    const idempotencyId = `${input.identity.publicUserId}:${input.action.requestId}`;
    const replay = await this.dependencies.store.getIdempotentResponse(
      input.roomId,
      idempotencyId,
    );
    if (replay) return this.executionFromResponse({ ...replay, replayed: true });
    const now = await this.dependencies.store.now();
    const control = await this.dependencies.store.acquireController({
      roomId: input.roomId,
      seat,
      controller: {
        userId: input.identity.publicUserId,
        clientInstanceId: input.clientInstanceId,
        connectionId: input.connectionId ?? -1,
        acquiredAtMs: now,
        expiresAtMs: now + 30_000,
      },
      force: false,
    });
    if (control === "PASSIVE") {
      throw new MultiplayerError("PASSIVE_TAB", "This match is controlled by another tab.");
    }
    if (input.action.type === "EMOTE") {
      const actionId = this.dependencies.ids.id("emote");
      return {
        response: {
          actionId,
          revision: firstRead.revision,
          view: roomToView(firstRead),
          playbackState: firstRead.playbackState,
          replayed: false,
        },
        emote: {
          player: seat,
          emoteId: input.action.emoteId,
          expiresAtMs: now + 2_500,
        },
      };
    }

    const lockToken = this.dependencies.ids.id("lock");
    if (!(await this.dependencies.store.acquireRoomLock(input.roomId, lockToken, LOCK_TTL_MS))) {
      throw new MultiplayerError("LOCK_BUSY", "The previous classroom action is still resolving.");
    }
    let committed = false;
    try {
      const room = await this.requiredRoom(input.roomId);
      const lockedSeat = this.memberSeat(room, input.identity.publicUserId);
      const actionId = this.dependencies.ids.id("action");
      let outcome: Awaited<ReturnType<MultiplayerService["applyAction"]>>;
      try {
        outcome = await this.applyAction(room, lockedSeat, input.action, now, actionId);
      } catch (error) {
        if (error instanceof MultiplayerError && error.code === "RESOLVER_BUDGET_EXCEEDED") {
          const pauseResult = await this.dependencies.store.pauseRoomForResolverError({
            roomId: room.roomId,
            lockToken,
            expectedRevision: room.revision,
            nowMs: now,
          });
          committed = pauseResult === "PAUSED";
        }
        throw error;
      }
      const committedAtMs = await this.dependencies.store.now();
      if (outcome.room.deadline && outcome.room.deadline.endsAtMs > now) {
        outcome.room.deadline.endsAtMs = committedAtMs + (outcome.room.deadline.endsAtMs - now);
      }
      outcome.room.revision = room.revision + 1;
      outcome.room.updatedAtMs = committedAtMs;
      if (outcome.resolution) outcome.resolution.revision = outcome.room.revision;
      const response: MatchActionResponse = {
        actionId,
        revision: outcome.room.revision,
        view: roomToView(outcome.room),
        playbackState: outcome.room.playbackState,
        ...(outcome.resolution ? { resolution: outcome.resolution } : {}),
        replayed: false,
      };
      const result = await this.dependencies.store.commitRoom({
        roomId: room.roomId,
        lockToken,
        expectedRevision: room.revision,
        requestId: idempotencyId,
        nextRoom: outcome.room,
        response,
        resolution: outcome.resolution,
      });
      if (result.status === "LOCK_LOST") throw new MultiplayerError("LOCK_BUSY", "The room lease expired.");
      if (result.status === "STALE_REVISION") throw new MultiplayerError("STALE_REVISION", "A newer room revision already exists.");
      committed = true;
      const resolvedResponse = result.status === "REPLAYED"
        ? { ...result.response, replayed: true }
        : result.response;
      return {
        ...this.executionFromResponse(resolvedResponse),
        ...(outcome.emote ? { emote: outcome.emote } : {}),
      };
    } finally {
      if (!committed) await this.dependencies.store.releaseRoomLock(input.roomId, lockToken);
    }
  }

  async recover(roomId: string, afterRevision: number): Promise<MatchRecoveryResponse> {
    const room = await this.requiredRoom(roomId);
    if (afterRevision === 0 && room.revision === 0) {
      return {
        type: "FULL",
        currentRevision: room.revision,
        view: roomToView(room),
        playbackState: room.playbackState,
      };
    }
    const resolutions = room.history.filter((item) => item.revision > afterRevision);
    const expectedCount = room.revision - afterRevision;
    const consecutive =
      expectedCount >= 0 &&
      resolutions.length === expectedCount &&
      resolutions.every((item, index) => item.revision === afterRevision + index + 1);
    if (consecutive) {
      return {
        type: "DELTA",
        currentRevision: room.revision,
        view: roomToView(room),
        resolutions,
      };
    }
    return {
      type: "FULL",
      currentRevision: room.revision,
      view: roomToView(room),
      playbackState: room.playbackState,
    };
  }

  private async applyAction(
    source: RoomRecord,
    seat: 0 | 1,
    action: MatchAction,
    now: number,
    actionId: string,
  ): Promise<{
    room: RoomRecord;
    resolution?: ShotResolution;
    emote?: ActionExecution["emote"];
  }> {
    const room = structuredClone(source);
    if (action.type === "READY") {
      room.players[seat].ready = true;
      if (room.players.length === 2 && room.players.every((player) => player.ready)) {
        room.status = "COUNTDOWN";
        room.deadline = { kind: "COUNTDOWN", endsAtMs: now + COUNTDOWN_MS };
      }
      return { room };
    }
    if (action.type === "LEAVE") {
      if (room.players.length === 2) {
        const simulation = await createGameSimulationFromCheckpoint(room.checkpoint);
        simulation.forfeit(seat);
        room.checkpoint = simulation.createCheckpoint();
        room.playbackState = snapshotToPlayback(simulation.getSnapshot());
        simulation.dispose();
        room.status = "MATCH_OVER";
      } else {
        room.status = "CLOSED";
      }
      room.deadline = null;
      return { room };
    }
    if (action.type === "REMATCH_VOTE") {
      if (room.status !== "MATCH_OVER") throw new MultiplayerError("INVALID_ACTION", "The match is not over.");
      if (!room.rematchVotes.includes(seat)) room.rematchVotes.push(seat);
      if (room.rematchVotes.length === 2) {
        const starter = room.playbackState.activePlayer === 0 ? 1 : 0;
        const simulation = await createGameSimulation({ matchId: room.roomId, startingPlayer: starter });
        room.checkpoint = simulation.createCheckpoint();
        room.playbackState = snapshotToPlayback(simulation.getSnapshot());
        simulation.dispose();
        room.rematchVotes = [];
        room.status = "COUNTDOWN";
        room.deadline = { kind: "COUNTDOWN", endsAtMs: now + COUNTDOWN_MS };
      }
      return { room };
    }
    if (action.type === "ADVANCE_DEADLINE") {
      if (!room.deadline || room.deadline.kind !== action.expectedDeadlineKind || now < room.deadline.endsAtMs) {
        throw new MultiplayerError("INVALID_ACTION", "That classroom deadline has not expired.");
      }
      if (action.expectedDeadlineKind === "COUNTDOWN") {
        room.status = "PLAYING";
        room.deadline = { kind: "TURN", endsAtMs: now + TURN_MS };
        return { room };
      }
      if (action.expectedDeadlineKind === "TURN") {
        const simulation = await createGameSimulationFromCheckpoint(room.checkpoint);
        if (!simulation.expireTurn(room.playbackState.activePlayer)) {
          simulation.dispose();
          throw new MultiplayerError("INVALID_ACTION", "The turn has already advanced.");
        }
        room.checkpoint = simulation.createCheckpoint();
        room.playbackState = snapshotToPlayback(simulation.getSnapshot());
        simulation.dispose();
        room.deadline = { kind: "TURN", endsAtMs: now + TURN_MS };
        return { room };
      }
      if (action.expectedDeadlineKind === "RECONNECT") {
        const missing = room.deadline.playerId;
        if (!missing) throw new MultiplayerError("INVALID_ACTION", "No reconnecting player exists.");
        const loser = room.players.find((player) => player.playerId === missing)?.seat;
        if (loser === undefined) throw new MultiplayerError("INVALID_ACTION", "No reconnecting seat exists.");
        const controller = await this.dependencies.store.getController(room.roomId, loser);
        if (controller && controller.userId === missing && controller.expiresAtMs > now) {
          throw new MultiplayerError("INVALID_ACTION", "That player has reclaimed control.");
        }
        await this.dependencies.presence.hasActiveUser(room.roomId, missing);
        const simulation = await createGameSimulationFromCheckpoint(room.checkpoint);
        simulation.forfeit(loser);
        room.checkpoint = simulation.createCheckpoint();
        room.playbackState = snapshotToPlayback(simulation.getSnapshot());
        simulation.dispose();
        room.status = "MATCH_OVER";
        room.deadline = null;
        return { room };
      }
      room.status = "CLOSED";
      room.deadline = null;
      return { room };
    }
    if (action.type !== "SHOT") {
      throw new MultiplayerError("INVALID_ACTION", "This action does not mutate the match authority.");
    }
    if (room.status !== "PLAYING" || room.playbackState.activePlayer !== seat) {
      throw new MultiplayerError("UNAUTHORIZED", "It is not this fighter's turn.");
    }
    const simulation = await createGameSimulationFromCheckpoint(room.checkpoint);
    const startState = snapshotToPlayback(simulation.getSnapshot());
    const accepted = simulation.applyCommand(action.command);
    if (!accepted.accepted) {
      simulation.dispose();
      throw new MultiplayerError("INVALID_ACTION", accepted.reason);
    }
    const startedAt = performance.now();
    const timedEvents: TimedGameEvent[] = simulation.drainEvents().map((event) => ({ tickOffset: 0, event }));
    let durationTicks = 0;
    while (
      durationTicks < MAX_SIMULATION_TICKS &&
      (durationTicks === 0 || !["AIMING", "MATCH_OVER"].includes(simulation.getPhase()))
    ) {
      simulation.step();
      durationTicks += 1;
      for (const event of simulation.drainEvents()) {
        if (timedEvents.length < MAX_TIMED_EVENTS) timedEvents.push({ tickOffset: durationTicks, event });
      }
      if (performance.now() - startedAt > MAX_RESOLVER_CPU_MS) {
        simulation.dispose();
        room.status = "PAUSED_ERROR";
        throw new MultiplayerError("RESOLVER_BUDGET_EXCEEDED", "The physics resolver exceeded its CPU budget.");
      }
    }
    if (!["AIMING", "MATCH_OVER"].includes(simulation.getPhase())) {
      if (!simulation.resolveSafetyDraw()) {
        simulation.dispose();
        throw new MultiplayerError("RESOLVER_BUDGET_EXCEEDED", "The physics resolver entered an invalid phase.");
      }
      for (const event of simulation.drainEvents()) {
        if (timedEvents.length < MAX_TIMED_EVENTS) timedEvents.push({ tickOffset: durationTicks, event });
      }
      const roundPresentationTicks = PHYSICS.roundOverSeconds * TICKS_PER_SECOND + 1;
      for (let tick = 0; tick < roundPresentationTicks && simulation.getPhase() === "ROUND_OVER"; tick += 1) {
        simulation.step();
        durationTicks += 1;
        for (const event of simulation.drainEvents()) {
          if (timedEvents.length < MAX_TIMED_EVENTS) timedEvents.push({ tickOffset: durationTicks, event });
        }
      }
    }
    room.checkpoint = simulation.createCheckpoint();
    room.playbackState = snapshotToPlayback(simulation.getSnapshot());
    simulation.dispose();
    room.status = room.playbackState.phase === "MATCH_OVER" ? "MATCH_OVER" : "PLAYING";
    room.deadline = room.status === "PLAYING" ? { kind: "TURN", endsAtMs: now + TURN_MS } : null;
    const resolution: ShotResolution = {
      protocolVersion: PROTOCOL_VERSION,
      gameVersion: GAME_VERSION,
      roomId: room.roomId,
      revision: room.revision + 1,
      actionId,
      player: seat,
      command: action.command,
      startState,
      finalState: room.playbackState,
      durationTicks,
      timedEvents,
      finalStateHash: hashPlaybackState(room.playbackState),
    };
    if (JSON.stringify(resolution).length > MAX_RESOLUTION_BYTES) {
      room.status = "PAUSED_ERROR";
      throw new MultiplayerError("RESOLVER_BUDGET_EXCEEDED", "The playback resolution exceeded its size budget.");
    }
    return { room, resolution };
  }

  private executionFromResponse(response: MatchActionResponse): ActionExecution {
    return {
      response,
      event: {
        type: "MATCH_UPDATED",
        protocolVersion: PROTOCOL_VERSION,
        gameVersion: GAME_VERSION,
        roomId: response.view.roomId,
        revision: response.revision,
        actionId: response.actionId,
        finalStateHash: hashPlaybackState(response.playbackState),
        view: response.view,
        ...(response.resolution ? { resolution: response.resolution } : {}),
      },
    };
  }

  private eventForRoom(room: RoomRecord, actionId: string): MatchUpdatedEvent {
    return {
      type: "MATCH_UPDATED",
      protocolVersion: PROTOCOL_VERSION,
      gameVersion: GAME_VERSION,
      roomId: room.roomId,
      revision: room.revision,
      actionId,
      finalStateHash: hashPlaybackState(room.playbackState),
      view: roomToView(room),
    };
  }

  private async requiredRoom(roomId: string) {
    const room = await this.dependencies.store.getRoom(roomId);
    if (!room) throw new MultiplayerError("ROOM_NOT_FOUND", "This classroom desk no longer exists.");
    if (
      room.versions.protocolVersion !== PROTOCOL_VERSION ||
      room.versions.gameVersion !== GAME_VERSION ||
      room.versions.checkpointVersion !== CHECKPOINT_VERSION ||
      room.versions.physicsVersion !== PHYSICS_VERSION
    ) {
      throw new MultiplayerError(
        "MATCH_INVALIDATED_BY_UPDATE",
        "This desk was created by an incompatible game build. Start a new match.",
      );
    }
    if (room.provisioningStatus !== "READY") {
      throw new MultiplayerError("ROOM_NOT_READY", "This classroom desk is still being prepared.");
    }
    return room;
  }

  private memberSeat(room: RoomRecord, userId: string): 0 | 1 {
    const seat = room.players.find((player) => player.playerId === userId)?.seat;
    if (seat === undefined) throw new MultiplayerError("UNAUTHORIZED", "This account does not own a seat.");
    return seat;
  }

  private player(identity: Identity, seat: 0 | 1, cosmeticId: SharpenerCosmeticId) {
    return {
      playerId: identity.publicUserId,
      displayName: identity.displayName.slice(0, 20),
      avatarUrl: identity.avatarUrl,
      seat,
      cosmeticId,
      ready: false,
      connected: true,
    };
  }

  private assertVersions(versions: RuntimeVersions) {
    if (
      versions.protocolVersion !== PROTOCOL_VERSION ||
      versions.gameVersion !== GAME_VERSION ||
      versions.checkpointVersion !== CHECKPOINT_VERSION ||
      versions.physicsVersion !== PHYSICS_VERSION
    ) {
      throw new MultiplayerError("UPDATE_REQUIRED", "Refresh Sharpener Fights before joining this desk.");
    }
  }
}
