import {
  FixedStepAccumulator,
  FIXED_DT,
  type GameSimulation,
} from "@sharpener/game-core";
import { PROTOCOL_VERSION } from "@sharpener/protocol";
import type {
  EmoteId,
  LobbyMetadata,
  LobbyPlayer,
  PlayerIndex,
  RoomMode,
  ServerRealtimeMessage,
  SharpenerCosmeticId,
  ShotCommand,
} from "@sharpener/protocol";

const COUNTDOWN_MS = 3_000;
const RECONNECT_MS = 30_000;
const EMOTE_COOLDOWN_MS = 2_000;
const FRAME_SECONDS = 1 / 20;
const OVERLOAD_WINDOW_MS = 30_000;
const MAX_OVERLOADS = 5;

export type RoomPlayerIdentity = {
  userId: string;
  sessionId: string;
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
};

type JoinedPlayer = RoomPlayerIdentity & LobbyPlayer;

export type RoomAction =
  | {
      type: "JOIN";
      identity: RoomPlayerIdentity;
      cosmeticId: SharpenerCosmeticId;
    }
  | { type: "READY"; userId: string }
  | { type: "SHOT"; userId: string; command: ShotCommand }
  | { type: "EMOTE"; userId: string; emoteId: EmoteId }
  | { type: "DISCONNECT"; userId: string }
  | { type: "RECONNECT"; identity: RoomPlayerIdentity }
  | { type: "LEAVE"; userId: string }
  | { type: "REMATCH_VOTE"; userId: string };

export type RoomEffect =
  | { type: "SEND"; userId: string; message: ServerRealtimeMessage }
  | { type: "BROADCAST"; message: ServerRealtimeMessage }
  | { type: "CLOSE"; reason: "SERVER_OVERLOADED" };

export interface AuthoritativeRoom {
  dispatch(action: RoomAction): RoomEffect[];
  advance(elapsedSeconds: number): RoomEffect[];
  getLobby(): LobbyMetadata;
  getSnapshot(): ReturnType<GameSimulation["getSnapshot"]>;
  dispose(): void;
}

type CreateRoomOptions = {
  roomId: string;
  mode: RoomMode;
  simulation: GameSimulation;
  now?: () => number;
};

export function createAuthoritativeRoom(
  options: CreateRoomOptions,
): AuthoritativeRoom {
  return new AuthoritativeRoomController(options);
}

class AuthoritativeRoomController implements AuthoritativeRoom {
  private readonly players: JoinedPlayer[] = [];
  private readonly accumulator = new FixedStepAccumulator({
    fixedDt: FIXED_DT,
    maxCatchUpSteps: 12,
    maxElapsedSeconds: 0.25,
  });
  private status: LobbyMetadata["status"] = "WAITING";
  private countdownEndsAtMs: number | null = null;
  private reconnectDeadlineMs: number | null = null;
  private disconnectedUserId: string | null = null;
  private pendingPauseUserId: string | null = null;
  private pausedFromStatus: "WAITING" | "COUNTDOWN" | "PLAYING" | null = null;
  private frameSeq = 0;
  private frameElapsedSeconds = 0;
  private readonly emoteAt = new Map<string, number>();
  private readonly rematchVotes = new Set<PlayerIndex>();
  private overloads: number[] = [];
  private startingPlayer: PlayerIndex = 0;
  private disposed = false;
  private readonly now: () => number;

  constructor(private readonly options: CreateRoomOptions) {
    this.now = options.now ?? Date.now;
  }

  dispatch(action: RoomAction): RoomEffect[] {
    this.assertActive();
    switch (action.type) {
      case "JOIN":
        return this.join(action.identity, action.cosmeticId);
      case "READY":
        return this.ready(action.userId);
      case "SHOT":
        return this.shot(action.userId, action.command);
      case "EMOTE":
        return this.emote(action.userId, action.emoteId);
      case "DISCONNECT":
        return this.disconnect(action.userId);
      case "RECONNECT":
        return this.reconnect(action.identity);
      case "LEAVE":
        return this.leave(action.userId);
      case "REMATCH_VOTE":
        return this.voteRematch(action.userId);
    }
  }

  advance(elapsedSeconds: number): RoomEffect[] {
    this.assertActive();
    const effects: RoomEffect[] = [];
    const now = this.now();

    if (this.status === "COUNTDOWN" && now >= (this.countdownEndsAtMs ?? Infinity)) {
      this.status = "PLAYING";
      this.countdownEndsAtMs = null;
      this.accumulator.reset();
      this.frameElapsedSeconds = 0;
      return effects;
    }

    if (
      this.status === "PAUSED_RECONNECT" &&
      now >= (this.reconnectDeadlineMs ?? Infinity)
    ) {
      this.applyDisconnectForfeit();
      return effects;
    }

    if (this.status !== "PLAYING") return effects;

    const result = this.accumulator.advance(elapsedSeconds, () => {
      this.options.simulation.step();
    });
    if (result.overloaded) {
      this.overloads = this.overloads.filter(
        (timestamp) => now - timestamp <= OVERLOAD_WINDOW_MS,
      );
      this.overloads.push(now);
      if (this.overloads.length >= MAX_OVERLOADS) {
        this.status = "CLOSED";
        effects.push(
          {
            type: "BROADCAST",
            message: this.error(
              "SERVER_OVERLOADED",
              "The classroom server could not keep a fair physics clock.",
            ),
          },
          { type: "CLOSE", reason: "SERVER_OVERLOADED" },
        );
        return effects;
      }
    }

    const snapshot = this.options.simulation.getSnapshot();
    if (this.pendingPauseUserId && snapshot.phase === "AIMING") {
      this.disconnectedUserId = this.pendingPauseUserId;
      this.pendingPauseUserId = null;
      this.pausedFromStatus = "PLAYING";
      this.status = "PAUSED_RECONNECT";
      return effects;
    }

    const events = this.options.simulation.drainEvents();
    if (events.some((event) => event.type === "MATCH_ENDED")) {
      this.status = "MATCH_OVER";
      this.reconnectDeadlineMs = null;
    }

    this.frameElapsedSeconds += Math.min(elapsedSeconds, 0.25);
    if (this.frameElapsedSeconds >= FRAME_SECONDS || events.length > 0) {
      this.frameElapsedSeconds %= FRAME_SECONDS;
      this.frameSeq += 1;
      effects.push({
        type: "BROADCAST",
        message: {
          type: "GAME_FRAME",
          protocolVersion: PROTOCOL_VERSION,
          roomId: this.options.roomId,
          frameSeq: this.frameSeq,
          serverTick: snapshot.tick,
          snapshot,
          events,
        },
      });
    }
    return effects;
  }

  getLobby(): LobbyMetadata {
    return {
      roomId: this.options.roomId,
      mode: this.options.mode,
      status: this.status,
      players: this.players.map(({ userId: _userId, sessionId: _sessionId, ...player }) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        seat: player.seat,
        cosmeticId: player.cosmeticId,
        ready: player.ready,
        connected: player.connected,
      })),
      countdownEndsAtMs: this.countdownEndsAtMs,
      reconnectDeadlineMs: this.reconnectDeadlineMs,
      rematchVotes: [...this.rematchVotes],
    };
  }

  getSnapshot() {
    return this.options.simulation.getSnapshot();
  }

  dispose() {
    if (this.disposed) return;
    this.options.simulation.dispose();
    this.disposed = true;
  }

  private join(
    identity: RoomPlayerIdentity,
    cosmeticId: SharpenerCosmeticId,
  ): RoomEffect[] {
    if (this.status !== "WAITING" || this.players.length >= 2) {
      return [this.sendError(identity.userId, "ROOM_FULL", "This desk already has two fighters.")];
    }
    if (this.players.some((player) => player.userId === identity.userId)) {
      return [this.sendError(identity.userId, "UNAUTHORIZED", "This account already owns a seat.")];
    }
    if (this.players.some((player) => player.cosmeticId === cosmeticId)) {
      return [
        this.sendError(
          identity.userId,
          "COSMETIC_UNAVAILABLE",
          "Choose a different sharpener color.",
        ),
      ];
    }
    const seat = this.players.length as PlayerIndex;
    this.players.push({
      ...identity,
      seat,
      cosmeticId,
      ready: false,
      connected: true,
    });
    return [];
  }

  private ready(userId: string): RoomEffect[] {
    const player = this.playerByUser(userId);
    if (!player) return [this.sendError(userId, "UNAUTHORIZED", "No room seat belongs to this account.")];
    player.ready = true;
    if (
      this.status === "WAITING" &&
      this.players.length === 2 &&
      this.players.every((candidate) => candidate.ready && candidate.connected)
    ) {
      this.status = "COUNTDOWN";
      this.countdownEndsAtMs = this.now() + COUNTDOWN_MS;
    }
    return [];
  }

  private shot(userId: string, command: ShotCommand): RoomEffect[] {
    const player = this.playerByUser(userId);
    const snapshot = this.options.simulation.getSnapshot();
    if (
      !player ||
      this.status !== "PLAYING" ||
      player.seat !== snapshot.activePlayer
    ) {
      return [this.sendError(userId, "UNAUTHORIZED", "It is not this fighter's turn.")];
    }
    const result = this.options.simulation.applyCommand(command);
    if (!result.accepted) {
      return [this.sendError(userId, "INVALID_MESSAGE", result.reason)];
    }
    return [
      {
        type: "BROADCAST",
        message: {
          type: "SHOT_ACCEPTED",
          player: player.seat,
          serverTick: snapshot.tick,
          command,
        },
      },
    ];
  }

  private emote(userId: string, emoteId: EmoteId): RoomEffect[] {
    const player = this.playerByUser(userId);
    if (!player) return [this.sendError(userId, "UNAUTHORIZED", "No room seat belongs to this account.")];
    const now = this.now();
    if (now - (this.emoteAt.get(userId) ?? -Infinity) < EMOTE_COOLDOWN_MS) {
      return [this.sendError(userId, "RATE_LIMITED", "Wait before sending another emote.")];
    }
    this.emoteAt.set(userId, now);
    return [
      {
        type: "BROADCAST",
        message: {
          type: "EMOTE_SHOWN",
          player: player.seat,
          emoteId,
          expiresAtMs: now + 2_500,
        },
      },
    ];
  }

  private disconnect(userId: string): RoomEffect[] {
    const player = this.playerByUser(userId);
    if (!player) return [];
    player.connected = false;
    this.reconnectDeadlineMs = this.now() + RECONNECT_MS;
    const phase = this.options.simulation.getSnapshot().phase;
    if (phase === "AIMING") {
      this.disconnectedUserId = userId;
      this.pausedFromStatus =
        this.status === "WAITING" || this.status === "COUNTDOWN"
          ? this.status
          : "PLAYING";
      this.status = "PAUSED_RECONNECT";
    } else if (phase !== "MATCH_OVER") {
      this.pendingPauseUserId = userId;
    }
    return [];
  }

  private reconnect(identity: RoomPlayerIdentity): RoomEffect[] {
    const player = this.playerByUser(identity.userId);
    if (!player || player.sessionId !== identity.sessionId) {
      return [this.sendError(identity.userId, "UNAUTHORIZED", "This session does not own the reserved seat.")];
    }
    player.connected = true;
    this.disconnectedUserId = null;
    this.pendingPauseUserId = null;
    this.reconnectDeadlineMs = null;
    if (this.status === "PAUSED_RECONNECT") {
      this.status = this.pausedFromStatus ?? "PLAYING";
      if (this.status === "COUNTDOWN") {
        this.countdownEndsAtMs = this.now() + COUNTDOWN_MS;
      }
    }
    this.pausedFromStatus = null;
    return [];
  }

  private leave(userId: string): RoomEffect[] {
    const player = this.playerByUser(userId);
    if (!player) return [];
    if (this.status === "PLAYING" || this.status === "PAUSED_RECONNECT") {
      this.options.simulation.forfeit(player.seat);
      this.status = "MATCH_OVER";
    }
    return [];
  }

  private voteRematch(userId: string): RoomEffect[] {
    const player = this.playerByUser(userId);
    if (!player || this.status !== "MATCH_OVER") return [];
    this.rematchVotes.add(player.seat);
    if (this.rematchVotes.size === 2) {
      this.startingPlayer = this.startingPlayer === 0 ? 1 : 0;
      this.options.simulation.reset({
        matchId: this.options.roomId,
        startingPlayer: this.startingPlayer,
      });
      this.rematchVotes.clear();
      this.status = "COUNTDOWN";
      this.countdownEndsAtMs = this.now() + COUNTDOWN_MS;
      this.accumulator.reset();
    }
    return [];
  }

  private applyDisconnectForfeit() {
    const player = this.disconnectedUserId
      ? this.playerByUser(this.disconnectedUserId)
      : undefined;
    if (player && this.players.length === 2) {
      this.options.simulation.forfeit(player.seat);
      this.status = "MATCH_OVER";
    } else {
      this.status = "CLOSED";
    }
    this.reconnectDeadlineMs = null;
    this.pausedFromStatus = null;
  }

  private playerByUser(userId: string) {
    return this.players.find((player) => player.userId === userId);
  }

  private sendError(
    userId: string,
    code: Extract<ServerRealtimeMessage, { type: "ERROR" }>["code"],
    message: string,
  ): RoomEffect {
    return { type: "SEND", userId, message: this.error(code, message) };
  }

  private error(
    code: Extract<ServerRealtimeMessage, { type: "ERROR" }>["code"],
    message: string,
  ): Extract<ServerRealtimeMessage, { type: "ERROR" }> {
    return { type: "ERROR", code, message };
  }

  private assertActive() {
    if (this.disposed) throw new Error("AuthoritativeRoom has been disposed");
  }
}
