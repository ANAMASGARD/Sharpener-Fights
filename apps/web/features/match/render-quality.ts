export type RenderQuality = "high" | "balanced" | "low";

export type RenderProfile = {
  dpr: number;
  shadowMapSize: 512 | 1024 | 2048;
  anisotropy: 2 | 4 | 8;
  n8ao: boolean;
};

export const RENDER_PROFILES: Record<RenderQuality, RenderProfile> = {
  high: { dpr: 1.5, shadowMapSize: 2048, anisotropy: 8, n8ao: true },
  balanced: {
    dpr: 1.25,
    shadowMapSize: 1024,
    anisotropy: 4,
    n8ao: false,
  },
  low: { dpr: 1, shadowMapSize: 512, anisotropy: 2, n8ao: false },
};

export function initialRenderQuality({
  coarsePointer,
  viewportWidth,
}: {
  coarsePointer: boolean;
  viewportWidth: number;
}): RenderQuality {
  return !coarsePointer && viewportWidth >= 900 ? "high" : "balanced";
}

export function degradeRenderQuality(
  quality: RenderQuality,
): RenderQuality {
  if (quality === "high") return "balanced";
  if (quality === "balanced") return "low";
  return "low";
}

export function canEnableN8ao({
  isWebGL2,
  hasColorBufferFloat,
}: {
  isWebGL2: boolean;
  hasColorBufferFloat: boolean;
}) {
  return isWebGL2 && hasColorBufferFloat;
}

export function performanceBounds(): [number, number] {
  return [50, Number.POSITIVE_INFINITY];
}
