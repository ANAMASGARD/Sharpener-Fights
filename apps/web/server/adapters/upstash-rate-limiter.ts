import { Redis } from "@upstash/redis";

const SCRIPT = `#!lua flags=allow-key-locking
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
  return current
`;

export class UpstashRateLimiter {
  constructor(private readonly redis: Redis) {}

  static fromEnvironment() {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error("Upstash Redis is not configured");
    return new UpstashRateLimiter(new Redis({
      url,
      token,
      automaticDeserialization: false,
    }));
  }

  async allow(scope: string, identifier: string, limit: number, windowMs = 60_000) {
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `sf:rate:${scope}:${identifier}:${bucket}`;
    const count = await this.redis.eval<unknown[], number>(SCRIPT, [key], [windowMs]);
    return count <= limit;
  }
}
