import { ArraySchema, Schema, type } from "@colyseus/schema";
import type { LobbyMetadata } from "@sharpener/protocol";

export class LobbyPlayerState extends Schema {
  @type("string") playerId = "";
  @type("string") displayName = "";
  @type("string") avatarUrl = "";
  @type("number") seat = 0;
  @type("string") cosmeticId = "ember-red";
  @type("boolean") ready = false;
  @type("boolean") connected = false;
}

export class LobbyState extends Schema {
  @type("string") roomId = "";
  @type("string") mode = "FRIEND";
  @type("string") status = "WAITING";
  @type([LobbyPlayerState]) players = new ArraySchema<LobbyPlayerState>();
  @type("number") countdownEndsAtMs = 0;
  @type("number") reconnectDeadlineMs = 0;
  @type(["number"]) rematchVotes = new ArraySchema<number>();
}

export function syncLobbyState(state: LobbyState, view: LobbyMetadata) {
  state.roomId = view.roomId;
  state.mode = view.mode;
  state.status = view.status;
  state.countdownEndsAtMs = view.countdownEndsAtMs ?? 0;
  state.reconnectDeadlineMs = view.reconnectDeadlineMs ?? 0;
  state.players.clear();
  for (const player of view.players) {
    const next = new LobbyPlayerState();
    next.playerId = player.playerId;
    next.displayName = player.displayName;
    next.avatarUrl = player.avatarUrl ?? "";
    next.seat = player.seat;
    next.cosmeticId = player.cosmeticId;
    next.ready = player.ready;
    next.connected = player.connected;
    state.players.push(next);
  }
  state.rematchVotes.clear();
  state.rematchVotes.push(...view.rematchVotes);
}
