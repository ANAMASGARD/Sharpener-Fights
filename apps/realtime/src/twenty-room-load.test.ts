import { describe, expect, it } from "vitest";
import { createGameSimulation } from "@sharpener/game-core";
import { createAuthoritativeRoom } from "./room-controller";

describe("twenty-room authority load gate", () => {
  it("advances twenty active rooms without tripping the overload circuit", async () => {
    const rooms = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
      const roomId = `load-room-${index}`;
      const simulation = await createGameSimulation({ matchId: roomId });
      let nowMs = 0;
      const room = createAuthoritativeRoom({ roomId, mode: "INSTANT", simulation, now: () => nowMs });
      room.dispatch({ type: "JOIN", identity: { userId: `a-${index}`, sessionId: `sa-${index}`, playerId: `pa-${index}`, displayName: "A", avatarUrl: null }, cosmeticId: "ember-red" });
      room.dispatch({ type: "JOIN", identity: { userId: `b-${index}`, sessionId: `sb-${index}`, playerId: `pb-${index}`, displayName: "B", avatarUrl: null }, cosmeticId: "ocean-blue" });
      room.dispatch({ type: "READY", userId: `a-${index}` });
      room.dispatch({ type: "READY", userId: `b-${index}` });
      nowMs = 3_000;
      room.advance(0);
      return room;
    }));
    for (let frame = 0; frame < 120; frame += 1) {
      for (const room of rooms) {
        expect(room.advance(1 / 120).some((effect) => effect.type === "CLOSE")).toBe(false);
      }
    }
    expect(rooms.every((room) => room.getLobby().status === "PLAYING")).toBe(true);
    rooms.forEach((room) => room.dispose());
  });
});
