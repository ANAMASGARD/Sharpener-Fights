import { describe, expect, it } from "vitest";
import type { LobbyMetadata } from "@sharpener/protocol";
import { LobbyState, syncLobbyState } from "./lobby-state";

describe("LobbyState", () => {
  it("synchronizes room metadata without duplicating physics transforms", () => {
    const view: LobbyMetadata = {
      roomId: "room-one",
      mode: "FRIEND",
      status: "PLAYING",
      players: [
        {
          playerId: "player-one",
          displayName: "Asha",
          avatarUrl: null,
          seat: 0,
          cosmeticId: "ember-red",
          ready: true,
          connected: true,
        },
      ],
      countdownEndsAtMs: null,
      reconnectDeadlineMs: null,
      rematchVotes: [],
    };
    const state = new LobbyState();
    syncLobbyState(state, view);
    const serialized = state.toJSON() as Record<string, unknown>;

    expect(serialized).toMatchObject({ roomId: "room-one", status: "PLAYING" });
    expect(JSON.stringify(serialized)).not.toMatch(/position|rotation|velocity|sharpeners/);
  });
});
