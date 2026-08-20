import { describe, expect, it } from "vitest";
import { hasShotAuthority, visibleAimPower } from "./aim-session";

const authority = {
  matchId: "local-match",
  roundId: 1,
  turnId: 4,
  player: 0 as const,
};

describe("hasShotAuthority", () => {
  it("accepts only the exact aiming turn that started the drag", () => {
    expect(
      hasShotAuthority(authority, {
        matchId: "local-match",
        roundId: 1,
        turnId: 4,
        activePlayer: 0,
        phase: "AIMING",
      }),
    ).toBe(true);

    expect(
      hasShotAuthority(authority, {
        matchId: "local-match",
        roundId: 1,
        turnId: 5,
        activePlayer: 1,
        phase: "AIMING",
      }),
    ).toBe(false);
  });

  it("rejects release after the match leaves aiming", () => {
    expect(
      hasShotAuthority(authority, {
        matchId: "local-match",
        roundId: 1,
        turnId: 4,
        activePlayer: 0,
        phase: "MOVING",
      }),
    ).toBe(false);
  });
});

describe("visibleAimPower", () => {
  it("hides power from an expired turn", () => {
    expect(visibleAimPower({ turnId: 4, power01: 0.42 }, 4)).toBe(0.42);
    expect(visibleAimPower({ turnId: 4, power01: 0.42 }, 5)).toBe(0);
    expect(visibleAimPower(null, 5)).toBe(0);
  });
});
