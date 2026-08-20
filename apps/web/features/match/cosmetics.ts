import {
  SharpenerCosmeticIdSchema,
  type SharpenerCosmeticId,
} from "@sharpener/protocol";

export type SharpenerCosmetic = {
  id: SharpenerCosmeticId;
  name: string;
  body: string;
  edge: string;
  highlight: string;
};

export const COSMETICS: readonly SharpenerCosmetic[] = [
  {
    id: "ember-red",
    name: "Ember Red",
    body: "#bd3f27",
    edge: "#762316",
    highlight: "#f58b61",
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    body: "#1688a8",
    edge: "#07536d",
    highlight: "#64c7d9",
  },
  {
    id: "sunflower-yellow",
    name: "Sunflower",
    body: "#d8a91f",
    edge: "#89640b",
    highlight: "#f5d96e",
  },
  {
    id: "classroom-green",
    name: "Classroom Green",
    body: "#4e8a58",
    edge: "#285031",
    highlight: "#8fc795",
  },
  {
    id: "graphite-black",
    name: "Graphite",
    body: "#34383a",
    edge: "#151718",
    highlight: "#747b7e",
  },
  {
    id: "aluminium-silver",
    name: "Aluminium",
    body: "#a7aa9f",
    edge: "#5d625f",
    highlight: "#e4e5dc",
  },
] as const;

type CosmeticStorage = Pick<Storage, "getItem" | "setItem">;
const STORAGE_KEY = "sharpener-fights:cosmetic";

export function chooseOpponentCosmetic(
  player: SharpenerCosmeticId,
  entropy: number,
): SharpenerCosmeticId {
  const choices = COSMETICS.filter(({ id }) => id !== player);
  const bounded = Math.min(Math.max(entropy, 0), 0.999999);
  return choices[Math.floor(bounded * choices.length)].id;
}

export function readStoredCosmetic(
  storage: Pick<CosmeticStorage, "getItem">,
): SharpenerCosmeticId {
  const parsed = SharpenerCosmeticIdSchema.safeParse(storage.getItem(STORAGE_KEY));
  return parsed.success ? parsed.data : "ember-red";
}

export function writeStoredCosmetic(
  storage: Pick<CosmeticStorage, "setItem">,
  cosmetic: SharpenerCosmeticId,
) {
  storage.setItem(STORAGE_KEY, cosmetic);
}

export function getCosmetic(id: SharpenerCosmeticId) {
  return COSMETICS.find((cosmetic) => cosmetic.id === id) ?? COSMETICS[0];
}
