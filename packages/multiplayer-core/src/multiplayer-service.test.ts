import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_VERSION,
  createGameSimulation,
} from "@sharpener/game-core";
import {
  GAME_VERSION,
  PHYSICS_VERSION,
  PROTOCOL_VERSION,
  type RuntimeVersions,
} from "@sharpener/protocol";
import { createMultiplayerService } from "./multiplayer-service";
import { snapshotToPlayback } from "./playback";
import { MemoryAuthorityStore } from "./testing/memory-authority-store";

const versions: RuntimeVersions = {
  protocolVersion: PROTOCOL_VERSION,
  gameVersion: GAME_VERSION,
  checkpointVersion: CHECKPOINT_VERSION,
  physicsVersion: PHYSICS_VERSION,
  clientBuildId: "test-build",
};

const host = {
  publicUserId: "host-user",
  displayName: "Host",
  avatarUrl: null,
};

const guest = {
  publicUserId: "guest-user",
  displayName: "Guest",
  avatarUrl: null,
};

function dependencies() {
  let sequence = 0;
  const store = new MemoryAuthorityStore({ now: () => 1_000_000 });
  const provisioned: string[] = [];
  const service = createMultiplayerService({
    store,
    realtime: {
      ensureRoom: async (roomId) => {
        provisioned.push(roomId);
      },
      deleteRoom: async () => undefined,
      publish: async () => undefined,
      publishEmote: async () => undefined,
    },
    ids: {
      id: (prefix) => `${prefix}-${++sequence}`,
      inviteCode: (operationId) => `invite-${operationId}-0123456789`,
    },
    hasher: { hash: (value) => `hash:${value}` },
    presence: {
      isConnectionActive: async () => false,
      hasActiveUser: async () => false,
    },
  });
  return { service, store, provisioned };
}

describe("MultiplayerService", () => {
  it("provisions a friend room idempotently and stores only the invite hash", async () => {
    const { service, store, provisioned } = dependencies();
    const input = {
      identity: host,
      operationId: "operation-1",
      cosmeticId: "ember-red" as const,
      versions,
      origin: "https://sharpfights.example",
    };

    const first = await service.createFriendRoom(input);
    const retry = await service.createFriendRoom(input);

    expect(retry).toEqual(first);
    expect(provisioned).toEqual([first.roomId, first.roomId]);
    expect(await store.findInvite(`hash:${first.inviteCode}`)).toMatchObject({
      codeHash: `hash:${first.inviteCode}`,
      roomId: first.roomId,
    });
    expect(JSON.stringify(await store.debug())).not.toContain(`"${first.inviteCode}"`);
  });

  it("claims an invitation once and returns the guest seat", async () => {
    const { service } = dependencies();
    const created = await service.createFriendRoom({
      identity: host,
      operationId: "operation-claim",
      cosmeticId: "ember-red",
      versions,
      origin: "https://sharpfights.example",
    });

    await expect(
      service.claimInvite({
        identity: guest,
        operationId: "claim-1",
        inviteCode: created.inviteCode,
        cosmeticId: "ocean-blue",
        versions,
      }),
    ).resolves.toMatchObject({ roomId: created.roomId, seat: 1 });
    await expect(
      service.claimInvite({
        identity: { ...guest, publicUserId: "other-user" },
        operationId: "claim-2",
        inviteCode: created.inviteCode,
        cosmeticId: "classroom-green",
        versions,
      }),
    ).rejects.toMatchObject({ code: "INVITE_UNAVAILABLE" });
  });

  it("commits ready actions once and starts countdown with authoritative time", async () => {
    const { service } = dependencies();
    const created = await service.createFriendRoom({
      identity: host,
      operationId: "operation-ready",
      cosmeticId: "ember-red",
      versions,
      origin: "https://sharpfights.example",
    });
    await service.claimInvite({
      identity: guest,
      operationId: "claim-ready",
      inviteCode: created.inviteCode,
      cosmeticId: "ocean-blue",
      versions,
    });

    const first = await service.executeAction({
      identity: host,
      roomId: created.roomId,
      clientInstanceId: "host-tab",
      action: { type: "READY", requestId: "ready-host" },
      versions,
    });
    const replay = await service.executeAction({
      identity: host,
      roomId: created.roomId,
      clientInstanceId: "host-tab",
      action: { type: "READY", requestId: "ready-host" },
      versions,
    });
    expect(replay.response).toEqual({ ...first.response, replayed: true });

    const second = await service.executeAction({
      identity: guest,
      roomId: created.roomId,
      clientInstanceId: "guest-tab",
      action: { type: "READY", requestId: "ready-guest" },
      versions,
    });
    expect(second.response.view).toMatchObject({
      status: "COUNTDOWN",
      countdownEndsAtMs: 1_003_000,
    });
    expect(second.event?.actionId).toBe(second.response.actionId);
  });

  it("scopes request idempotency to the authenticated player", async () => {
    const { service } = dependencies();
    const created = await service.createFriendRoom({
      identity: host,
      operationId: "operation-scoped-request",
      cosmeticId: "ember-red",
      versions,
      origin: "https://sharpfights.example",
    });
    await service.claimInvite({
      identity: guest,
      operationId: "claim-scoped-request",
      inviteCode: created.inviteCode,
      cosmeticId: "ocean-blue",
      versions,
    });

    await service.executeAction({
      identity: host,
      roomId: created.roomId,
      clientInstanceId: "host-tab",
      action: { type: "READY", requestId: "shared-browser-id" },
      versions,
    });
    const guestReady = await service.executeAction({
      identity: guest,
      roomId: created.roomId,
      clientInstanceId: "guest-tab",
      action: { type: "READY", requestId: "shared-browser-id" },
      versions,
    });

    expect(guestReady.response.replayed).toBe(false);
    expect(guestReady.response.view.status).toBe("COUNTDOWN");
  });

  it("pairs compatible queue tickets and keeps equal cosmetics visually distinct", async () => {
    const { service } = dependencies();
    await expect(service.joinMatchmaking({
      identity: host,
      ticketId: "ticket-host",
      cosmeticId: "ocean-blue",
      regionPool: "asia",
      versions,
    })).resolves.toMatchObject({ status: "WAITING", ticketId: "ticket-host" });

    const paired = await service.joinMatchmaking({
      identity: guest,
      ticketId: "ticket-guest",
      cosmeticId: "ocean-blue",
      regionPool: "asia",
      versions,
    });
    expect(paired).toMatchObject({ status: "MATCHED", ticketId: "ticket-guest" });
    if (paired.status !== "MATCHED") throw new Error("Expected a matched room");

    const session = await service.getSession(host, paired.roomId, 0);
    expect(session.recovery.type).toBe("FULL");
    if (session.recovery.type !== "FULL") throw new Error("Expected a full admission state");
    expect(session.recovery.view.players.map((player) => player.cosmeticId)).toEqual([
      "ocean-blue",
      "ember-red",
    ]);
    await expect(service.matchmakingStatus(host, "ticket-host", "asia")).resolves.toMatchObject({
      status: "MATCHED",
      roomId: paired.roomId,
      seat: 0,
    });
  });

  it("recovers a full state when the requested revision predates retained history", async () => {
    const { service, store } = dependencies();
    const simulation = await createGameSimulation({ matchId: "recovery-room" });
    const room = await store.seedRoom({
      roomId: "recovery-room",
      mode: "FRIEND",
      provisioningStatus: "READY",
      status: "PLAYING",
      operationId: "recovery-op",
      revision: 20,
      versions,
      players: [],
      checkpoint: simulation.createCheckpoint(),
      playbackState: snapshotToPlayback(simulation.getSnapshot()),
      deadline: null,
      rematchVotes: [],
      history: [],
      createdAtMs: 1,
      updatedAtMs: 1,
    });
    simulation.dispose();

    await expect(service.recover(room.roomId, 1)).resolves.toMatchObject({
      type: "FULL",
      currentRevision: 20,
    });
  });

  it("fails closed when a room checkpoint belongs to an incompatible runtime", async () => {
    const { service, store } = dependencies();
    const simulation = await createGameSimulation({ matchId: "old-room" });
    await store.seedRoom({
      roomId: "old-room",
      mode: "FRIEND",
      provisioningStatus: "READY",
      status: "PLAYING",
      operationId: "old-operation",
      revision: 1,
      versions: { ...versions, checkpointVersion: CHECKPOINT_VERSION + 1 },
      players: [{
        playerId: host.publicUserId,
        displayName: host.displayName,
        avatarUrl: null,
        seat: 0,
        cosmeticId: "ember-red",
        ready: true,
        connected: true,
      }],
      checkpoint: simulation.createCheckpoint(),
      playbackState: snapshotToPlayback(simulation.getSnapshot()),
      deadline: null,
      rematchVotes: [],
      history: [],
      createdAtMs: 1,
      updatedAtMs: 1,
    });
    simulation.dispose();

    await expect(service.getSession(host, "old-room", 0)).rejects.toMatchObject({
      code: "MATCH_INVALIDATED_BY_UPDATE",
    });
  });

  it("pauses only the controlling connection and lets the same account reclaim during grace", async () => {
    const { service } = dependencies();
    const created = await service.createFriendRoom({
      identity: host,
      operationId: "operation-reconnect",
      cosmeticId: "ember-red",
      versions,
      origin: "https://sharpfights.example",
    });
    await service.claimInvite({
      identity: guest,
      operationId: "claim-reconnect",
      inviteCode: created.inviteCode,
      cosmeticId: "ocean-blue",
      versions,
    });
    await service.claimController({ identity: guest, roomId: created.roomId, clientInstanceId: "guest-old", connectionId: 42, force: false });

    const event = await service.handleConnectionLeft({
      eventId: "webhook-1",
      roomId: created.roomId,
      publicUserId: guest.publicUserId,
      connectionId: 42,
    });
    expect(event?.revision).toBe(1);
    await expect(service.getSession(host, created.roomId, 0)).resolves.toMatchObject({
      recovery: { type: "FULL", view: { status: "PAUSED_RECONNECT" } },
    });

    const reclaimed = await service.claimController({
      identity: guest,
      roomId: created.roomId,
      clientInstanceId: "guest-new",
      connectionId: 84,
      force: true,
    });
    expect(reclaimed).toMatchObject({ mode: "ACTIVE", view: { status: "WAITING" } });
  });
});
