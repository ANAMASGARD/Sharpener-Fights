import { describe, expect, it } from "vitest";
import { createIdentityAuthority } from "./identity-authority";

describe("IdentityAuthority", () => {
  it("publishes only sanitized trusted Clerk profile fields and caches them", async () => {
    let profileReads = 0;
    const authority = createIdentityAuthority({
      verify: async () => ({ userId: "user-1", sessionId: "session-1" }),
      getProfile: async () => {
        profileReads += 1;
        return {
          firstName: "  Asha\nThe Champion With A Very Long Name  ",
          avatarUrl: "https://img.example/asha.png",
        };
      },
      getSession: async () => ({ status: "active", userId: "user-1" }),
      now: () => 1_000,
    });

    const first = await authority.authenticate("token-one");
    const second = await authority.authenticate("token-two");
    expect(first).toMatchObject({
      userId: "user-1",
      sessionId: "session-1",
      displayName: "Asha The Champion Wi",
      avatarUrl: "https://img.example/asha.png",
    });
    expect(second.displayName).toBe(first.displayName);
    expect(profileReads).toBe(1);
  });

  it("reconnects only while the same verified Clerk session remains active", async () => {
    let session = { status: "active", userId: "user-1" };
    const authority = createIdentityAuthority({
      verify: async () => ({ userId: "user-1", sessionId: "session-1" }),
      getProfile: async () => ({ firstName: "Asha", avatarUrl: null }),
      getSession: async () => session,
    });
    const identity = await authority.authenticate("token");
    expect(await authority.canReconnect(identity)).toBe(true);
    session = { status: "revoked", userId: "user-1" };
    expect(await authority.canReconnect(identity)).toBe(false);
  });
});
