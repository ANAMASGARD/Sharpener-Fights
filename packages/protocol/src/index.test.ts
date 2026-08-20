import { describe, expect, it } from "vitest";
import { SharpenerCosmeticIdSchema, ShotCommandSchema } from "./index";

const validCommand = {
  type: "SHOT" as const,
  matchId: "match-1",
  roundId: 1,
  turnId: 1,
  shotId: "shot-1",
  direction: { x: 0, z: -1 },
  power01: 0.5,
  hitPointLocal: { x: 0, y: 0, z: 0 },
};

describe("ShotCommandSchema", () => {
  it("accepts a finite, normalized shot command", () => {
    expect(ShotCommandSchema.parse(validCommand)).toEqual(validCommand);
  });

  it("rejects impossible direction, power, and coordinates", () => {
    expect(() =>
      ShotCommandSchema.parse({
        ...validCommand,
        direction: { x: 12, z: 0 },
        power01: 2,
        hitPointLocal: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
      }),
    ).toThrow();
  });
});

describe("SharpenerCosmeticIdSchema", () => {
  it("accepts the six fair cosmetic choices and rejects unknown skins", () => {
    expect(SharpenerCosmeticIdSchema.options).toEqual([
      "ember-red",
      "ocean-blue",
      "sunflower-yellow",
      "classroom-green",
      "graphite-black",
      "aluminium-silver",
    ]);
    expect(SharpenerCosmeticIdSchema.safeParse("neon-pay-to-win").success).toBe(
      false,
    );
  });
});
