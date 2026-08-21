import { describe, expect, it } from "vitest";
import { createMultiplayerRegistry } from "./multiplayer-registry";

function createHarness() {
  let nowMs = 1_000;
  let entropy = 0;
  const registry = createMultiplayerRegistry({
    now: () => nowMs,
    randomBytes(length) {
      entropy += 1;
      return new Uint8Array(length).fill(entropy);
    },
  });
  return {
    registry,
    advance(ms: number) {
      nowMs += ms;
    },
  };
}

describe("MultiplayerRegistry", () => {
  it("allows one active online seat and only the same Clerk session can reclaim it", () => {
    const { registry } = createHarness();
    expect(
      registry.claimSeat({ userId: "u1", sessionId: "s1", roomId: "r1" }),
    ).toEqual({ accepted: true });
    expect(
      registry.claimSeat({ userId: "u1", sessionId: "s2", roomId: "r2" }),
    ).toEqual({ accepted: false, reason: "ACTIVE_SEAT" });
    expect(
      registry.canReclaim({ userId: "u1", sessionId: "s2", roomId: "r1" }),
    ).toBe(false);
    expect(
      registry.canReclaim({ userId: "u1", sessionId: "s1", roomId: "r1" }),
    ).toBe(true);
  });

  it("creates an unguessable fifteen-minute friend invite and expires it deterministically", () => {
    const { registry, advance } = createHarness();
    const created = registry.createInvite({
      userId: "u1",
      roomId: "r1",
      hostDisplayName: "Asha",
      hostAvatarUrl: null,
    });
    expect(created.accepted).toBe(true);
    if (!created.accepted) return;
    expect(created.invite.code).toHaveLength(22);
    expect(registry.resolveInvite(created.invite.code)?.state).toBe("AVAILABLE");
    expect(registry.findInviteByRoom("r1")?.code).toBe(created.invite.code);
    advance(15 * 60 * 1_000);
    expect(registry.resolveInvite(created.invite.code)?.state).toBe("EXPIRED");
  });

  it("pairs instant-match entrants in strict FIFO order", () => {
    const { registry } = createHarness();
    const first = registry.enqueue({
      userId: "u1",
      sessionId: "s1",
      cosmeticId: "ember-red",
    });
    expect(first).toEqual({ status: "WAITING", position: 1 });

    const second = registry.enqueue({
      userId: "u2",
      sessionId: "s2",
      cosmeticId: "ocean-blue",
    });
    expect(second).toMatchObject({
      status: "MATCHED",
      players: [{ userId: "u1" }, { userId: "u2" }],
    });
  });

  it("rate limits repeated queue joins per account", () => {
    const { registry } = createHarness();
    for (let index = 0; index < 10; index += 1) {
      expect(
        registry.enqueue({
          userId: "u1",
          sessionId: "s1",
          cosmeticId: "ember-red",
        }).status,
      ).not.toBe("RATE_LIMITED");
      registry.leaveQueue("u1");
    }
    expect(
      registry.enqueue({
        userId: "u1",
        sessionId: "s1",
        cosmeticId: "ember-red",
      }),
    ).toEqual({ status: "RATE_LIMITED" });
  });
});
