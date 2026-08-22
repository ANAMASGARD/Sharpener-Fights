import { createHash, createHmac, randomUUID } from "node:crypto";
import { createMultiplayerService } from "@sharpener/multiplayer-core";
import { LiveblocksAdapter } from "./adapters/liveblocks-adapter";
import { UpstashAuthorityStore } from "./adapters/upstash-authority-store";
import { UpstashRateLimiter } from "./adapters/upstash-rate-limiter";

let runtime: ReturnType<typeof buildRuntime> | undefined;

function buildRuntime() {
  const liveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
  const identitySecret = process.env.APP_IDENTITY_SECRET;
  if (!liveblocksSecret) throw new Error("LIVEBLOCKS_SECRET_KEY is not configured");
  if (!identitySecret) throw new Error("APP_IDENTITY_SECRET is not configured");
  const realtime = new LiveblocksAdapter(liveblocksSecret);
  const store = UpstashAuthorityStore.fromEnvironment();
  const service = createMultiplayerService({
    store,
    realtime,
    ids: {
      id: (prefix) => `${prefix}-${randomUUID()}`,
      inviteCode: (operationId) => createHmac("sha256", identitySecret)
        .update(`invite:${operationId}`)
        .digest("base64url"),
    },
    hasher: {
      hash: (value) => createHash("sha256").update(value).digest("hex"),
    },
    presence: realtime,
  });
  return {
    service,
    store,
    realtime,
    rateLimiter: UpstashRateLimiter.fromEnvironment(),
  };
}

export function getMultiplayerRuntime() {
  runtime ??= buildRuntime();
  return runtime;
}

export function multiplayerConfigured() {
  return Boolean(
    process.env.LIVEBLOCKS_SECRET_KEY &&
    process.env.APP_IDENTITY_SECRET &&
    (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN),
  );
}
