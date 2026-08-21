import { describe, expect, it } from "vitest";
import {
  FightRoomJoinOptionsSchema,
  InstantQueueJoinOptionsSchema,
  ClientRealtimeMessageSchema,
  EmoteIdSchema,
  InviteMetadataSchema,
  LocalWorkerRequestSchema,
  LocalWorkerResponseSchema,
  PROTOCOL_VERSION,
  RoomModeSchema,
  RoomStatusSchema,
  ServerRealtimeMessageSchema,
  type GameSnapshot,
} from "./index";

const snapshot: GameSnapshot = {
  matchId: "match-1",
  tick: 42,
  phase: "MOVING",
  roundId: 1,
  turnId: 2,
  activePlayer: 0,
  aimingTicksRemaining: 0,
  scores: [0, 0],
  roundWinner: null,
  matchWinner: null,
  shotCount: 1,
  sharpeners: [
    {
      player: 0,
      position: { x: 0, y: 0.013, z: 0.3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: -1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated: false,
    },
    {
      player: 1,
      position: { x: 0, y: 0.013, z: -0.3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated: false,
    },
  ],
};

const shot = {
  type: "SHOT" as const,
  matchId: "match-1",
  roundId: 1,
  turnId: 2,
  shotId: "shot-1",
  direction: { x: 0, z: -1 },
  power01: 0.5,
  hitPointLocal: { x: 0, y: 0, z: 0 },
};

describe("realtime protocol", () => {
  it("exposes the locked room modes, lifecycle states, and preset emotes", () => {
    expect(RoomModeSchema.options).toEqual(["FRIEND", "INSTANT"]);
    expect(RoomStatusSchema.options).toEqual([
      "WAITING",
      "COUNTDOWN",
      "PLAYING",
      "PAUSED_RECONNECT",
      "MATCH_OVER",
      "CLOSED",
    ]);
    expect(EmoteIdSchema.options).toEqual([
      "NICE_SHOT",
      "OOPS",
      "WOW",
      "SO_CLOSE",
      "GOOD_LUCK",
      "GOOD_GAME",
    ]);
  });

  it("validates completed client commands without continuous aim state", () => {
    expect(ClientRealtimeMessageSchema.parse(shot)).toEqual(shot);
    expect(
      ClientRealtimeMessageSchema.parse({
        type: "EMOTE",
        emoteId: "NICE_SHOT",
      }),
    ).toEqual({ type: "EMOTE", emoteId: "NICE_SHOT" });
    expect(ClientRealtimeMessageSchema.parse({ type: "SYNC_REQUEST" })).toEqual({ type: "SYNC_REQUEST" });
    expect(
      ClientRealtimeMessageSchema.safeParse({
        type: "AIM_UPDATE",
        power01: 0.8,
      }).success,
    ).toBe(false);
  });

  it("validates versioned friend-room and instant-queue join options", () => {
    expect(
      FightRoomJoinOptionsSchema.parse({
        protocolVersion: PROTOCOL_VERSION,
        buildId: "web-2026-08-21",
        mode: "FRIEND",
        cosmeticId: "ember-red",
        inviteCode: "0123456789abcdefghijkl",
      }),
    ).toMatchObject({ mode: "FRIEND", cosmeticId: "ember-red" });
    expect(
      InstantQueueJoinOptionsSchema.parse({
        protocolVersion: PROTOCOL_VERSION,
        buildId: "web-2026-08-21",
        cosmeticId: "ocean-blue",
      }),
    ).toMatchObject({ cosmeticId: "ocean-blue" });
    expect(
      FightRoomJoinOptionsSchema.safeParse({
        protocolVersion: PROTOCOL_VERSION + 1,
        buildId: "old-tab",
        mode: "FRIEND",
        cosmeticId: "ember-red",
      }).success,
    ).toBe(false);
  });

  it("validates sequenced authoritative frames and accepted shot commands", () => {
    expect(
      ServerRealtimeMessageSchema.parse({
        type: "GAME_FRAME",
        protocolVersion: PROTOCOL_VERSION,
        roomId: "room-1",
        frameSeq: 7,
        serverTick: 42,
        snapshot,
        events: [],
      }),
    ).toEqual({
      type: "GAME_FRAME",
      protocolVersion: PROTOCOL_VERSION,
      roomId: "room-1",
      frameSeq: 7,
      serverTick: 42,
      snapshot,
      events: [],
    });

    expect(
      ServerRealtimeMessageSchema.parse({
        type: "SHOT_ACCEPTED",
        player: 0,
        serverTick: 41,
        command: shot,
      }),
    ).toEqual({
      type: "SHOT_ACCEPTED",
      player: 0,
      serverTick: 41,
      command: shot,
    });

    expect(
      ServerRealtimeMessageSchema.safeParse({
        type: "GAME_FRAME",
        protocolVersion: PROTOCOL_VERSION,
        roomId: "room-1",
        frameSeq: -1,
        serverTick: 42,
        snapshot,
        events: [],
      }).success,
    ).toBe(false);

    expect(
      ServerRealtimeMessageSchema.parse({
        type: "QUEUE_STATUS",
        position: 1,
      }),
    ).toEqual({ type: "QUEUE_STATUS", position: 1 });
    expect(
      ServerRealtimeMessageSchema.parse({
        type: "MATCH_FOUND",
        roomId: "room-2",
      }),
    ).toEqual({ type: "MATCH_FOUND", roomId: "room-2" });
    expect(
      ServerRealtimeMessageSchema.parse({ type: "SEAT_ASSIGNED", seat: 1 }),
    ).toEqual({ type: "SEAT_ASSIGNED", seat: 1 });
  });

  it("validates lobby, invite, and local worker metadata at process seams", () => {
    expect(
      InviteMetadataSchema.parse({
        code: "0123456789abcdefghijkl",
        roomId: "room-1",
        hostDisplayName: "Asha",
        hostAvatarUrl: null,
        expiresAtMs: 1_800_000,
        state: "AVAILABLE",
      }),
    ).toEqual({
      code: "0123456789abcdefghijkl",
      roomId: "room-1",
      hostDisplayName: "Asha",
      hostAvatarUrl: null,
      expiresAtMs: 1_800_000,
      state: "AVAILABLE",
    });
    expect(
      ServerRealtimeMessageSchema.parse({
        type: "INVITE_CREATED",
        invite: {
          code: "0123456789abcdefghijkl",
          roomId: "room-1",
          hostDisplayName: "Asha",
          hostAvatarUrl: null,
          expiresAtMs: 1_800_000,
          state: "AVAILABLE",
        },
      }).type,
    ).toBe("INVITE_CREATED");
    expect(LocalWorkerRequestSchema.parse({ type: "RESET" })).toEqual({
      type: "RESET",
    });
    expect(
      LocalWorkerResponseSchema.parse({ type: "READY", snapshot }),
    ).toEqual({ type: "READY", snapshot });
  });
});
