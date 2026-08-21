import { describe, expect, it } from "vitest";
import { createGameSimulation } from "@sharpener/game-core";
import type { SharpenerCosmeticId } from "@sharpener/protocol";
import {
  createAuthoritativeRoom,
  type RoomPlayerIdentity,
} from "./room-controller";

const cosmetics: readonly [SharpenerCosmeticId, SharpenerCosmeticId] = [
  "ember-red",
  "ocean-blue",
];

const players: readonly [RoomPlayerIdentity, RoomPlayerIdentity] = [
  {
    userId: "user-a",
    sessionId: "session-a",
    playerId: "player-a",
    displayName: "Asha",
    avatarUrl: null,
  },
  {
    userId: "user-b",
    sessionId: "session-b",
    playerId: "player-b",
    displayName: "Ben",
    avatarUrl: null,
  },
];

async function createHarness() {
  let nowMs = 10_000;
  const simulation = await createGameSimulation({
    matchId: "room-one",
    startingPlayer: 0,
  });
  const room = createAuthoritativeRoom({
    roomId: "room-one",
    mode: "FRIEND",
    simulation,
    now: () => nowMs,
  });
  return {
    room,
    advanceClock(ms: number) {
      nowMs += ms;
      return room.advance(ms / 1000);
    },
  };
}

describe("AuthoritativeRoom", () => {
  it("starts a synchronized countdown only after both distinct players are ready", async () => {
    const { room, advanceClock } = await createHarness();
    room.dispatch({ type: "JOIN", identity: players[0], cosmeticId: cosmetics[0] });
    room.dispatch({ type: "JOIN", identity: players[1], cosmeticId: cosmetics[1] });

    room.dispatch({ type: "READY", userId: players[0].userId });
    expect(room.getLobby().status).toBe("WAITING");
    room.dispatch({ type: "READY", userId: players[1].userId });
    expect(room.getLobby().status).toBe("COUNTDOWN");

    advanceClock(2_999);
    expect(room.getLobby().status).toBe("COUNTDOWN");
    advanceClock(1);
    expect(room.getLobby().status).toBe("PLAYING");
    room.dispose();
  });

  it("rejects a duplicate cosmetic without partially admitting the player", async () => {
    const { room } = await createHarness();
    expect(
      room.dispatch({
        type: "JOIN",
        identity: players[0],
        cosmeticId: cosmetics[0],
      }),
    ).toEqual([]);

    const effects = room.dispatch({
      type: "JOIN",
      identity: players[1],
      cosmeticId: cosmetics[0],
    });
    expect(effects).toMatchObject([
      {
        type: "SEND",
        userId: "user-b",
        message: { type: "ERROR", code: "COSMETIC_UNAVAILABLE" },
      },
    ]);
    expect(room.getLobby().players).toHaveLength(1);
    room.dispose();
  });

  it("accepts a shot only from the authoritative active player", async () => {
    const { room, advanceClock } = await createHarness();
    room.dispatch({ type: "JOIN", identity: players[0], cosmeticId: cosmetics[0] });
    room.dispatch({ type: "JOIN", identity: players[1], cosmeticId: cosmetics[1] });
    room.dispatch({ type: "READY", userId: players[0].userId });
    room.dispatch({ type: "READY", userId: players[1].userId });
    advanceClock(3_000);
    const snapshot = room.getSnapshot();
    const command = {
      type: "SHOT" as const,
      matchId: snapshot.matchId,
      roundId: snapshot.roundId,
      turnId: snapshot.turnId,
      shotId: "shot-one",
      direction: { x: 0, z: -1 },
      power01: 0.5,
      hitPointLocal: { x: 0, y: 0, z: 0 },
    };

    expect(
      room.dispatch({ type: "SHOT", userId: players[1].userId, command }),
    ).toMatchObject([
      {
        type: "SEND",
        userId: "user-b",
        message: { type: "ERROR", code: "UNAUTHORIZED" },
      },
    ]);
    expect(
      room.dispatch({ type: "SHOT", userId: players[0].userId, command }),
    ).toMatchObject([
      {
        type: "BROADCAST",
        message: { type: "SHOT_ACCEPTED", player: 0, command },
      },
    ]);
    room.dispose();
  });

  it("pauses a disconnected aiming turn and forfeits after the reservation expires", async () => {
    const { room, advanceClock } = await createHarness();
    room.dispatch({ type: "JOIN", identity: players[0], cosmeticId: cosmetics[0] });
    room.dispatch({ type: "JOIN", identity: players[1], cosmeticId: cosmetics[1] });
    room.dispatch({ type: "READY", userId: players[0].userId });
    room.dispatch({ type: "READY", userId: players[1].userId });
    advanceClock(3_000);

    room.dispatch({ type: "DISCONNECT", userId: players[0].userId });
    expect(room.getLobby()).toMatchObject({
      status: "PAUSED_RECONNECT",
      reconnectDeadlineMs: 43_000,
    });
    advanceClock(30_000);
    expect(room.getSnapshot()).toMatchObject({ matchWinner: 1, phase: "MATCH_OVER" });
    expect(room.getLobby().status).toBe("MATCH_OVER");
    room.dispose();
  });

  it("reclaims a paused seat only for the original session identity", async () => {
    const { room, advanceClock } = await createHarness();
    room.dispatch({ type: "JOIN", identity: players[0], cosmeticId: cosmetics[0] });
    room.dispatch({ type: "JOIN", identity: players[1], cosmeticId: cosmetics[1] });
    room.dispatch({ type: "READY", userId: players[0].userId });
    room.dispatch({ type: "READY", userId: players[1].userId });
    advanceClock(3_000);
    room.dispatch({ type: "DISCONNECT", userId: players[0].userId });
    expect(room.dispatch({ type: "RECONNECT", identity: { ...players[0], sessionId: "stolen" } })[0]).toMatchObject({ type: "SEND", message: { code: "UNAUTHORIZED" } });
    expect(room.getLobby().status).toBe("PAUSED_RECONNECT");
    expect(room.dispatch({ type: "RECONNECT", identity: players[0] })).toEqual([]);
    expect(room.getLobby()).toMatchObject({ status: "PLAYING", reconnectDeadlineMs: null });
    room.dispose();
  });

  it("resumes the pre-match lifecycle instead of starting play after a reconnect", async () => {
    const { room } = await createHarness();
    room.dispatch({ type: "JOIN", identity: players[0], cosmeticId: cosmetics[0] });
    room.dispatch({ type: "DISCONNECT", userId: players[0].userId });
    expect(room.getLobby().status).toBe("PAUSED_RECONNECT");
    room.dispatch({ type: "RECONNECT", identity: players[0] });
    expect(room.getLobby().status).toBe("WAITING");
    room.dispose();
  });

  it("rate limits emotes to one every two seconds", async () => {
    const { room, advanceClock } = await createHarness();
    room.dispatch({ type: "JOIN", identity: players[0], cosmeticId: cosmetics[0] });
    const first = room.dispatch({
      type: "EMOTE",
      userId: players[0].userId,
      emoteId: "GOOD_LUCK",
    });
    expect(first[0]).toMatchObject({
      type: "BROADCAST",
      message: { type: "EMOTE_SHOWN", player: 0, emoteId: "GOOD_LUCK" },
    });
    expect(
      room.dispatch({
        type: "EMOTE",
        userId: players[0].userId,
        emoteId: "WOW",
      }),
    ).toMatchObject([
      {
        type: "SEND",
        message: { type: "ERROR", code: "RATE_LIMITED" },
      },
    ]);
    advanceClock(2_000);
    expect(
      room.dispatch({
        type: "EMOTE",
        userId: players[0].userId,
        emoteId: "WOW",
      })[0],
    ).toMatchObject({ type: "BROADCAST" });
    room.dispose();
  });
});
