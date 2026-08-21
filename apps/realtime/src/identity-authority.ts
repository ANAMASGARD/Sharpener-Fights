import { randomUUID } from "node:crypto";
import { createClerkClient, verifyToken } from "@clerk/backend";
import type { RoomPlayerIdentity } from "./room-controller";

const PROFILE_TTL_MS = 5 * 60 * 1_000;

type VerifiedClaims = { userId: string; sessionId: string };
type TrustedProfile = { firstName: string | null; avatarUrl: string | null };
type TrustedSession = { status: string; userId: string };

type IdentityDependencies = {
  verify: (token: string) => Promise<VerifiedClaims>;
  getProfile: (userId: string) => Promise<TrustedProfile>;
  getSession: (sessionId: string) => Promise<TrustedSession>;
  now?: () => number;
  createPlayerId?: () => string;
};

export interface IdentityAuthority {
  authenticate(token: string): Promise<RoomPlayerIdentity>;
  canReconnect(identity: RoomPlayerIdentity): Promise<boolean>;
}

export function createIdentityAuthority(
  dependencies: IdentityDependencies,
): IdentityAuthority {
  const profiles = new Map<
    string,
    { profile: TrustedProfile; expiresAtMs: number }
  >();
  const now = dependencies.now ?? Date.now;
  const createPlayerId = dependencies.createPlayerId ?? randomUUID;

  return {
    async authenticate(token) {
      const claims = await dependencies.verify(token);
      let cached = profiles.get(claims.userId);
      if (!cached || cached.expiresAtMs <= now()) {
        cached = {
          profile: await dependencies.getProfile(claims.userId),
          expiresAtMs: now() + PROFILE_TTL_MS,
        };
        profiles.set(claims.userId, cached);
      }
      return {
        ...claims,
        playerId: createPlayerId(),
        displayName: sanitizeName(cached.profile.firstName),
        avatarUrl: cached.profile.avatarUrl,
      };
    },

    async canReconnect(identity) {
      try {
        const session = await dependencies.getSession(identity.sessionId);
        return session.status === "active" && session.userId === identity.userId;
      } catch {
        return false;
      }
    },
  };
}

export function createClerkIdentityAuthority(
  environment: NodeJS.ProcessEnv = process.env,
): IdentityAuthority {
  const secretKey = required(environment.CLERK_SECRET_KEY, "CLERK_SECRET_KEY");
  const jwtKey = environment.CLERK_JWT_KEY;
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY;
  const authorizedParties = required(
    environment.ALLOWED_WEB_ORIGINS,
    "ALLOWED_WEB_ORIGINS",
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const clerk = createClerkClient({ secretKey, jwtKey, publishableKey });

  return createIdentityAuthority({
    async verify(token) {
      const claims = await verifyToken(token, {
        secretKey,
        jwtKey,
        authorizedParties,
      });
      if (typeof claims.sub !== "string" || typeof claims.sid !== "string") {
        throw new Error("Clerk session token is missing sub or sid");
      }
      return { userId: claims.sub, sessionId: claims.sid };
    },
    async getProfile(userId) {
      const user = await clerk.users.getUser(userId);
      return { firstName: user.firstName, avatarUrl: user.imageUrl };
    },
    async getSession(sessionId) {
      const session = await clerk.sessions.getSession(sessionId);
      return {
        status: session.status,
        userId: session.userId,
      };
    },
  });
}

function sanitizeName(name: string | null) {
  const normalized = (name ?? "Player")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  return normalized || "Player";
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
