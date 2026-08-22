import { CHECKPOINT_VERSION } from "@sharpener/game-core";
import {
  ControllerResponseSchema,
  FriendRoomCreateResponseSchema,
  GAME_VERSION,
  InvitePreviewSchema,
  MatchActionResponseSchema,
  MatchAdmissionResponseSchema,
  MatchSessionResponseSchema,
  MatchmakingStatusResponseSchema,
  PHYSICS_VERSION,
  PROTOCOL_VERSION,
  type MatchAction,
  type SharpenerCosmeticId,
} from "@sharpener/protocol";
import type { z } from "zod";

export const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID
  ?? process.env.NEXT_PUBLIC_PWA_CACHE_VERSION
  ?? "development";

const publicVersions = {
  protocolVersion: PROTOCOL_VERSION,
  gameVersion: GAME_VERSION,
  clientBuildId: CLIENT_BUILD_ID,
};

export function operationId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function getClientInstanceId() {
  const key = "sharpener-fights-client-instance";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const value = `client-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(key, value);
  return value;
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `Classroom request failed (${response.status}).`);
  return schema.parse(payload);
}

export const multiplayerApi = {
  createFriendRoom(cosmeticId: SharpenerCosmeticId, requestId = operationId("friend")) {
    return request("/api/friends", FriendRoomCreateResponseSchema, {
      method: "POST",
      body: JSON.stringify({ operationId: requestId, cosmeticId, ...publicVersions }),
    });
  },
  previewInvite(code: string) {
    return request(`/api/invites/${encodeURIComponent(code)}`, InvitePreviewSchema);
  },
  claimInvite(code: string, cosmeticId: SharpenerCosmeticId, requestId = operationId("claim")) {
    return request(`/api/invites/${encodeURIComponent(code)}`, MatchAdmissionResponseSchema, {
      method: "POST",
      body: JSON.stringify({ operationId: requestId, cosmeticId, ...publicVersions }),
    });
  },
  joinQueue(ticketId: string, cosmeticId: SharpenerCosmeticId, regionPool = "global") {
    return request("/api/matchmaking", MatchmakingStatusResponseSchema, {
      method: "POST",
      body: JSON.stringify({ ticketId, cosmeticId, regionPool, ...publicVersions }),
    });
  },
  queueStatus(ticketId: string, regionPool = "global") {
    return request(`/api/matchmaking?ticketId=${encodeURIComponent(ticketId)}&regionPool=${encodeURIComponent(regionPool)}`, MatchmakingStatusResponseSchema);
  },
  async cancelQueue(ticketId: string, regionPool = "global") {
    await fetch(`/api/matchmaking?ticketId=${encodeURIComponent(ticketId)}&regionPool=${encodeURIComponent(regionPool)}`, { method: "DELETE", credentials: "same-origin" });
  },
  session(roomId: string, afterRevision = 0) {
    return request(`/api/matches/${encodeURIComponent(roomId)}?afterRevision=${afterRevision}`, MatchSessionResponseSchema);
  },
  action(roomId: string, clientInstanceId: string, connectionId: number | undefined, action: MatchAction) {
    return request(`/api/matches/${encodeURIComponent(roomId)}/actions`, MatchActionResponseSchema, {
      method: "POST",
      body: JSON.stringify({ clientInstanceId, connectionId, action, ...publicVersions }),
    });
  },
  controller(roomId: string, clientInstanceId: string, connectionId: number, force = false) {
    return request(`/api/matches/${encodeURIComponent(roomId)}/controller`, ControllerResponseSchema, {
      method: "POST",
      body: JSON.stringify({ requestId: operationId("control"), clientInstanceId, connectionId, force }),
    });
  },
};

export const RUNTIME_VERSIONS = {
  ...publicVersions,
  checkpointVersion: CHECKPOINT_VERSION,
  physicsVersion: PHYSICS_VERSION,
};
