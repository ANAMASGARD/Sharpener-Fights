import { createGameSimulation, FIXED_DT } from "@sharpener/game-core";
import {
  ClientRealtimeMessageSchema,
  FightRoomJoinOptionsSchema,
  PROTOCOL_VERSION,
  SharpenerCosmeticIdSchema,
  type FightRoomJoinOptions,
  type ServerRealtimeMessage,
  type SharpenerCosmeticId,
} from "@sharpener/protocol";
import { Room, type AuthContext, type Client } from "colyseus";
import { LobbyState, syncLobbyState } from "./lobby-state";
import {
  createAuthoritativeRoom,
  type AuthoritativeRoom,
  type RoomAction,
  type RoomEffect,
  type RoomPlayerIdentity,
} from "./room-controller";
import { getServerContext } from "./server-context";
import { assertCompatibleBuild } from "./build-compatibility";

type FightRoomCreateOptions = FightRoomJoinOptions & {
  expectedPlayers?: Array<RoomPlayerIdentity & { cosmeticId: SharpenerCosmeticId }>;
};

type AuthenticatedClient = Client & { auth: RoomPlayerIdentity };

export class FightRoom extends Room<{ state: LobbyState }> {
  maxClients = 2;
  private controller!: AuthoritativeRoom;
  private createOptions!: FightRoomCreateOptions;
  private readonly clientsByUser = new Map<string, AuthenticatedClient>();
  private readonly seatByUser = new Map<string, 0 | 1>();

  static async onAuth(token: string, options: unknown, _context: AuthContext) {
    const admission = FightRoomJoinOptionsSchema.parse(options);
    assertCompatibleBuild(admission.buildId, process.env.BUILD_ID ?? "development");
    if (!token) throw new Error("A verified Clerk session is required");
    return getServerContext().identity.authenticate(token);
  }

  async onCreate(options: FightRoomCreateOptions) {
    this.createOptions = {
      ...FightRoomJoinOptionsSchema.parse(options),
      expectedPlayers: options.expectedPlayers,
    };
    const simulation = await createGameSimulation({ matchId: this.roomId });
    this.controller = createAuthoritativeRoom({
      roomId: this.roomId,
      mode: this.createOptions.mode,
      simulation,
    });
    this.setState(new LobbyState());
    this.syncLobby();
    this.onMessage("client_message", (client, message) => {
      const parsed = ClientRealtimeMessageSchema.safeParse(message);
      if (!parsed.success) {
        client.send("server_message", {
          type: "ERROR",
          code: "INVALID_MESSAGE",
          message: "The game command was malformed.",
        } satisfies ServerRealtimeMessage);
        return;
      }
      const userId = (client as AuthenticatedClient).auth.userId;
      if (parsed.data.type === "SYNC_REQUEST") {
        this.sendSessionView(client as AuthenticatedClient);
        return;
      }
      const action = this.toAction(userId, parsed.data);
      this.apply(this.controller.dispatch(action));
    });
    this.setSimulationInterval((elapsedMs) => {
      this.apply(this.controller.advance(elapsedMs / 1_000));
    }, FIXED_DT * 1_000);
  }

  onJoin(client: AuthenticatedClient, rawOptions: unknown) {
    const options = FightRoomJoinOptionsSchema.parse(rawOptions);
    const expected = this.createOptions.expectedPlayers?.find(
      (player) => player.userId === client.auth.userId,
    );
    if (this.createOptions.expectedPlayers && !expected) {
      throw new Error("This instant-match seat belongs to another account");
    }
    if (this.createOptions.mode === "FRIEND" && this.state.players.length > 0) {
      const invite = options.inviteCode
        ? getServerContext().registry.resolveInvite(options.inviteCode)
        : null;
      if (!invite || invite.roomId !== this.roomId || invite.state !== "AVAILABLE") {
        throw new Error("This friend invitation is invalid or no longer available");
      }
    }
    const claim = getServerContext().registry.claimSeat({
      userId: client.auth.userId,
      sessionId: client.auth.sessionId,
      roomId: this.roomId,
    });
    if (!claim.accepted) throw new Error("This account already owns an active seat");

    this.clientsByUser.set(client.auth.userId, client);
    const requestedCosmetic = expected?.cosmeticId ?? options.cosmeticId;
    const cosmeticId = this.controller.getLobby().players.some((player) => player.cosmeticId === requestedCosmetic)
      ? SharpenerCosmeticIdSchema.options.find((candidate) => candidate !== requestedCosmetic) ?? requestedCosmetic
      : requestedCosmetic;
    this.apply(
      this.controller.dispatch({
        type: "JOIN",
        identity: expected ?? client.auth,
        cosmeticId,
      }),
    );
    const seat = this.controller
      .getLobby()
      .players.find((player) => player.playerId === (expected ?? client.auth).playerId)
      ?.seat;
    if (seat !== undefined) {
      this.seatByUser.set(client.auth.userId, seat);
      client.send("server_message", {
        type: "SEAT_ASSIGNED",
        seat,
      } satisfies ServerRealtimeMessage);
    }

    if (this.createOptions.mode === "FRIEND" && this.state.players.length === 1) {
      const result = getServerContext().registry.createInvite({
        userId: client.auth.userId,
        roomId: this.roomId,
        hostDisplayName: client.auth.displayName,
        hostAvatarUrl: client.auth.avatarUrl,
      });
      if (result.accepted) {
        client.send("server_message", {
          type: "INVITE_CREATED",
          invite: result.invite,
        } satisfies ServerRealtimeMessage);
      }
    } else if (this.state.players.length === 2) {
      getServerContext().registry.setInviteState(this.roomId, "FULL");
    }
  }

  onDrop(client: AuthenticatedClient) {
    this.apply(
      this.controller.dispatch({ type: "DISCONNECT", userId: client.auth.userId }),
    );
    void this.allowReconnection(client, 30).catch(() => undefined);
  }

  async onReconnect(client: AuthenticatedClient) {
    const registry = getServerContext().registry;
    const validSeat = registry.canReclaim({
      userId: client.auth.userId,
      sessionId: client.auth.sessionId,
      roomId: this.roomId,
    });
    if (!validSeat || !(await getServerContext().identity.canReconnect(client.auth))) {
      client.leave();
      return;
    }
    this.clientsByUser.set(client.auth.userId, client);
    this.apply(this.controller.dispatch({ type: "RECONNECT", identity: client.auth }));
  }

  onLeave(client: AuthenticatedClient) {
    this.clientsByUser.delete(client.auth.userId);
    this.apply(this.controller.dispatch({ type: "LEAVE", userId: client.auth.userId }));
    getServerContext().registry.releaseSeat(client.auth.userId, this.roomId);
  }

  onDispose() {
    this.controller?.dispose();
    for (const userId of this.clientsByUser.keys()) {
      getServerContext().registry.releaseSeat(userId, this.roomId);
    }
    getServerContext().registry.setInviteState(this.roomId, "CANCELLED");
  }

  private toAction(
    userId: string,
    message: Exclude<ReturnType<typeof ClientRealtimeMessageSchema.parse>, { type: "SYNC_REQUEST" }>,
  ): RoomAction {
    switch (message.type) {
      case "SHOT":
        return { type: "SHOT", userId, command: message };
      case "READY":
        return { type: "READY", userId };
      case "EMOTE":
        return { type: "EMOTE", userId, emoteId: message.emoteId };
      case "REMATCH_VOTE":
        return { type: "REMATCH_VOTE", userId };
      case "LEAVE":
        return { type: "LEAVE", userId };
    }
  }

  private sendSessionView(client: AuthenticatedClient) {
    const seat = this.seatByUser.get(client.auth.userId);
    if (seat !== undefined) client.send("server_message", { type: "SEAT_ASSIGNED", seat } satisfies ServerRealtimeMessage);
    const invite = getServerContext().registry.findInviteByRoom(this.roomId);
    if (invite && seat === 0) {
      client.send("server_message", { type: "INVITE_CREATED", invite } satisfies ServerRealtimeMessage);
    }
  }

  private apply(effects: RoomEffect[]) {
    for (const effect of effects) {
      if (effect.type === "BROADCAST") {
        this.broadcast("server_message", effect.message);
      } else if (effect.type === "SEND") {
        this.clientsByUser.get(effect.userId)?.send("server_message", effect.message);
      } else {
        void this.disconnect(1013);
      }
    }
    this.syncLobby();
  }

  private syncLobby() {
    if (this.state) syncLobbyState(this.state, this.controller.getLobby());
  }
}
