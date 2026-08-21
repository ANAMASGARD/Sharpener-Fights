import type { SharpenerCosmeticId } from "@sharpener/protocol";

const BODY_DIMENSIONS = Object.freeze({
  width: 0.049,
  height: 0.023,
  depth: 0.035,
});

export const SHARPENER_APPEARANCE = Object.freeze({
  body: BODY_DIMENSIONS,
  selector: Object.freeze({
    aspectRatio: BODY_DIMENSIONS.width / BODY_DIMENSIONS.depth,
    depthRem: 4.8,
  }),
  bevel: Object.freeze({ size: 0.0012, segments: 5 }),
  inlet: Object.freeze({
    radius: 0.0072,
    bezelRadius: 0.00835,
    tunnelLength: 0.047,
  }),
  blade: Object.freeze({
    width: 0.0115,
    height: 0.00145,
    length: 0.024,
    channelWidth: 0.014,
    channelLength: 0.027,
  }),
  screw: Object.freeze({ radius: 0.00335, height: 0.0012 }),
});

export type SharpenerMaterialProfile = Readonly<{
  dimensions: typeof BODY_DIMENSIONS;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}>;

const PLASTIC_PROFILE = Object.freeze({
  metalness: 0.04,
  roughness: 0.43,
  clearcoat: 0.32,
  clearcoatRoughness: 0.4,
});

const ALUMINIUM_PROFILE = Object.freeze({
  metalness: 0.68,
  roughness: 0.29,
  clearcoat: 0.1,
  clearcoatRoughness: 0.34,
});

export function getSharpenerMaterialProfile(
  cosmeticId: SharpenerCosmeticId,
): SharpenerMaterialProfile {
  return {
    dimensions: BODY_DIMENSIONS,
    ...(cosmeticId === "aluminium-silver"
      ? ALUMINIUM_PROFILE
      : PLASTIC_PROFILE),
  };
}
