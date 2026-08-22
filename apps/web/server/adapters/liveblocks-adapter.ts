import { Liveblocks } from "@liveblocks/node";
import {
  GAME_VERSION,
  PROTOCOL_VERSION,
  type EmoteId,
  type MatchUpdatedEvent,
} from "@sharpener/protocol";
import type {
  PresenceReader,
  RealtimePublisher,
} from "@sharpener/multiplayer-core";

export class LiveblocksAdapter implements RealtimePublisher, PresenceReader {
  readonly client: Liveblocks;

  constructor(secret: string) {
    this.client = new Liveblocks({ secret });
  }

  async ensureRoom(roomId: string) {
    await this.client.getOrCreateRoom(roomId, {
      defaultAccesses: [],
      metadata: { product: "sharpener-fights" },
    });
  }

  async deleteRoom(roomId: string) {
    await this.client.deleteRoom(roomId);
  }

  async publish(event: MatchUpdatedEvent) {
    await this.client.broadcastEvent(event.roomId, event);
  }

  async publishEmote(input: {
    roomId: string;
    actionId: string;
    player: 0 | 1;
    emoteId: EmoteId;
    expiresAtMs: number;
  }) {
    await this.client.broadcastEvent(input.roomId, {
      type: "MATCH_EMOTE",
      protocolVersion: PROTOCOL_VERSION,
      gameVersion: GAME_VERSION,
      ...input,
    });
  }

  async isConnectionActive(roomId: string, connectionId: number) {
    const users = await this.client.getActiveUsers(roomId);
    return users.data.some((user) => user.connectionId === connectionId);
  }

  async hasActiveUser(roomId: string, publicUserId: string) {
    const users = await this.client.getActiveUsers(roomId);
    return users.data.some((user) => user.id === publicUserId);
  }

  async authorize(input: {
    roomId: string;
    publicUserId: string;
    displayName: string;
    avatarUrl: string | null;
  }) {
    const session = this.client.prepareSession(input.publicUserId, {
      userInfo: {
        name: input.displayName,
        ...(input.avatarUrl ? { avatar: input.avatarUrl } : {}),
      },
    });
    session.allow(input.roomId, ["*:read", "storage:none"]);
    return session.authorize();
  }
}
