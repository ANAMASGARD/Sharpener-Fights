import { describe, expect, it } from "vitest";
import {
  COSMETICS,
  chooseOpponentCosmetic,
  readStoredCosmetic,
  resolveMatchCosmetics,
  writeStoredCosmetic,
} from "./cosmetics";

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("sharpener cosmetics", () => {
  it("offers six named visual choices with no physics attributes", () => {
    expect(COSMETICS).toHaveLength(6);
    expect(COSMETICS.map(({ id }) => id)).toEqual([
      "ember-red",
      "ocean-blue",
      "sunflower-yellow",
      "classroom-green",
      "graphite-black",
      "aluminium-silver",
    ]);
    expect(COSMETICS.every((cosmetic) => !("mass" in cosmetic))).toBe(true);
  });

  it("always gives the opponent a different deterministic color", () => {
    expect(chooseOpponentCosmetic("ember-red", 0)).toBe("ocean-blue");
    expect(chooseOpponentCosmetic("ember-red", 0.999)).toBe(
      "aluminium-silver",
    );
    expect(chooseOpponentCosmetic("aluminium-silver", 0)).toBe("ember-red");
  });

  it("persists only recognized cosmetic ids", () => {
    const valid = memoryStorage("classroom-green");
    const invalid = memoryStorage("pay-to-win-gold");
    expect(readStoredCosmetic(valid)).toBe("classroom-green");
    expect(readStoredCosmetic(invalid)).toBe("ember-red");

    writeStoredCosmetic(valid, "ocean-blue");
    expect(readStoredCosmetic(valid)).toBe("ocean-blue");
  });

  it("resolves each player to the selected cosmetic presentation in seat order", () => {
    expect(
      resolveMatchCosmetics(["sunflower-yellow", "graphite-black"]).map(
        ({ name, body }) => ({ name, body }),
      ),
    ).toEqual([
      { name: "Sunflower", body: "#d8a91f" },
      { name: "Graphite", body: "#34383a" },
    ]);
  });
});
