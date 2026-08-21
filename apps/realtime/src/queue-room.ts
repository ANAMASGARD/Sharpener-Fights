import {
  InstantQueueJoinOptionsSchema,
  type ServerRealtimeMessage,
} from "@sharpener/protocol";
import { matchMaker, Room, type AuthContext, type Client } from "colyseus";
import type { RoomPlayerIdentity } from "./room-controller";
import { getServerContext } from "./server-context";
import { assertCompatibleBuild } from "./build-compatibility";

type QueueClient = Client & { auth: RoomPlayerIdentity };

export class InstantQueueRoom extends Room {
  maxClients = 100;
  private readonly clientsByUser = new Map<string, QueueClient>();

  static async onAuth(token: string, options: unknown, _context: AuthContext) {
    const admission = InstantQueueJoinOptionsSchema.parse(options);
    assertCompatibleBuild(admission.buildId, process.env.BUILD_ID ?? "development");
    if (!token) throw new Error("A verified Clerk session is required");
    return getServerContext().identity.authenticate(token);
  }

  async onJoin(client: QueueClient, rawOptions: unknown) {
    const options = InstantQueueJoinOptionsSchema.parse(rawOptions);
    this.clientsByUser.set(client.auth.userId, client);
    const result = getServerContext().registry.enqueue({
      userId: client.auth.userId,
      sessionId: client.auth.sessionId,
      cosmeticId: options.cosmeticId,
    });
    if (result.status === "RATE_LIMITED") {
      client.send("server_message", this.error("RATE_LIMITED", "Please wait before joining the queue again."));
      client.leave();
      return;
    }
    if (result.status !== "MATCHED") {
      client.send("server_message", {
        type: "QUEUE_STATUS",
        position: result.position,
      } satisfies ServerRealtimeMessage);
      return;
    }

    const expectedPlayers = result.players.map((player) => {
      const queuedClient = this.clientsByUser.get(player.userId);
      if (!queuedClient) throw new Error("Matched queue client disappeared");
      return { ...queuedClient.auth, cosmeticId: player.cosmeticId };
    });
    const room = await matchMaker.createRoom("sharpener_match", {
      protocolVersion: options.protocolVersion,
      buildId: options.buildId,
      mode: "INSTANT",
      cosmeticId: options.cosmeticId,
      expectedPlayers,
    });
    for (const player of result.players) {
      this.clientsByUser.get(player.userId)?.send("server_message", {
        type: "MATCH_FOUND",
        roomId: room.roomId,
      } satisfies ServerRealtimeMessage);
    }
  }

  onLeave(client: QueueClient) {
    this.clientsByUser.delete(client.auth.userId);
    getServerContext().registry.leaveQueue(client.auth.userId);
  }

  private error(code: "RATE_LIMITED", message: string): ServerRealtimeMessage {
    return { type: "ERROR", code, message };
  }
}
