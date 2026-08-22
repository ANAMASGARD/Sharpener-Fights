import { CHECKPOINT_VERSION } from "@sharpener/game-core";
import {
  GAME_VERSION,
  PHYSICS_VERSION,
  PROTOCOL_VERSION,
  type RuntimeVersions,
} from "@sharpener/protocol";
import { MultiplayerError } from "@sharpener/multiplayer-core";
import type { Identity } from "@sharpener/multiplayer-core";
import { ZodError } from "zod";
import { ApiIdentityError } from "./adapters/identity-adapter";
import { getMultiplayerRuntime } from "./runtime";

export const runtimeVersions = (clientBuildId: string): RuntimeVersions => ({
  protocolVersion: PROTOCOL_VERSION,
  gameVersion: GAME_VERSION,
  checkpointVersion: CHECKPOINT_VERSION,
  physicsVersion: PHYSICS_VERSION,
  clientBuildId,
});

export async function readJson(request: Request, maximumBytes = 16_384) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maximumBytes) throw new HttpError(413, "Request body is too large.");
  const body = await request.text();
  if (body.length > maximumBytes) throw new HttpError(413, "Request body is too large.");
  try { return JSON.parse(body) as unknown; }
  catch { throw new HttpError(400, "Request body is not valid JSON."); }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new HttpError(403, "Cross-site classroom actions are blocked.");
  }
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "Cross-origin classroom actions are blocked.");
  }
}

export async function enforceRateLimits(input: {
  request: Request;
  identity: Identity;
  scope: string;
  accountLimit: number;
  roomId?: string;
}) {
  const ip = input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limiter = getMultiplayerRuntime().rateLimiter;
  const checks = await Promise.all([
    limiter.allow(input.scope, `account:${input.identity.publicUserId}`, input.accountLimit),
    limiter.allow(input.scope, `ip:${ip}`, input.accountLimit * 3),
    ...(input.roomId ? [limiter.allow(input.scope, `room:${input.roomId}`, input.accountLimit * 2)] : []),
  ]);
  if (checks.some((allowed) => !allowed)) throw new HttpError(429, "Too many classroom requests. Try again shortly.");
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: "The classroom request is incompatible or malformed." }, { status: 400 });
  }
  if (error instanceof HttpError || error instanceof ApiIdentityError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MultiplayerError) {
    const status = error.code === "UNAUTHORIZED" ? 403
      : error.code === "ROOM_NOT_FOUND" || error.code === "INVITE_UNAVAILABLE" ? 404
      : error.code === "LOCK_BUSY" || error.code === "STALE_REVISION" ? 409
      : error.code === "MATCH_INVALIDATED_BY_UPDATE" ? 409
      : error.code === "UPDATE_REQUIRED" ? 426
      : 400;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  console.error("multiplayer request failed", error instanceof Error ? error.message : "unknown error");
  return Response.json({ error: "The multiplayer desk is temporarily unavailable." }, { status: 503 });
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
