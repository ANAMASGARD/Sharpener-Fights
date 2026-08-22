import { createHmac } from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Identity } from "@sharpener/multiplayer-core";
import { localE2eAuthBypass } from "@/lib/auth-gate";

export async function requireApiIdentity(): Promise<Identity> {
  if (localE2eAuthBypass()) {
    return { publicUserId: "local-e2e-player", displayName: "Local Player", avatarUrl: null };
  }
  const { userId } = await auth();
  if (!userId) throw new ApiIdentityError();
  const secret = process.env.APP_IDENTITY_SECRET;
  if (!secret) throw new Error("APP_IDENTITY_SECRET is not configured");
  const user = await currentUser();
  const displayName = user?.username
    ?? user?.fullName
    ?? user?.primaryEmailAddress?.emailAddress.split("@")[0]
    ?? "Student";
  return {
    publicUserId: createHmac("sha256", secret).update(userId).digest("base64url"),
    displayName: displayName.slice(0, 20),
    avatarUrl: user?.imageUrl ?? null,
  };
}

export class ApiIdentityError extends Error {
  readonly status = 401;
  constructor() {
    super("Sign in to enter this classroom.");
  }
}
