import { createClient, type Room } from "@liveblocks/client";
import type { MatchRealtimeEvent } from "@sharpener/protocol";

type Presence = { clientInstanceId?: string };
type UserMeta = { id: string; info: { name: string; avatar?: string } };

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export type MatchTransportRoom = Room<Presence, never, UserMeta, MatchRealtimeEvent>;

export function enterMatchRoom(roomId: string, clientInstanceId: string) {
  return client.enterRoom<Presence, never, MatchRealtimeEvent>(roomId, {
    initialPresence: { clientInstanceId },
  });
}
