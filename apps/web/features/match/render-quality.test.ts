import { describe, expect, it } from "vitest";
import {
  RENDER_PROFILES,
  canEnableN8ao,
  degradeRenderQuality,
  initialRenderQuality,
  performanceBounds,
} from "./render-quality";

describe("initialRenderQuality", () => {
  it("starts fine-pointer desktop displays at high quality", () => {
    expect(
      initialRenderQuality({ coarsePointer: false, viewportWidth: 1440 }),
    ).toBe("high");
  });

  it("protects coarse-pointer and narrow displays with balanced quality", () => {
    expect(
      initialRenderQuality({ coarsePointer: true, viewportWidth: 1440 }),
    ).toBe("balanced");
    expect(
      initialRenderQuality({ coarsePointer: false, viewportWidth: 899 }),
    ).toBe("balanced");
  });
});

describe("render quality degradation", () => {
  it("degrades monotonically without passing below low", () => {
    expect(degradeRenderQuality("high")).toBe("balanced");
    expect(degradeRenderQuality("balanced")).toBe("low");
    expect(degradeRenderQuality("low")).toBe("low");
  });

  it("keeps N8AO high-tier-only and enforces the DPR and shadow budgets", () => {
    expect(RENDER_PROFILES).toEqual({
      high: { dpr: 1.5, shadowMapSize: 2048, anisotropy: 8, n8ao: true },
      balanced: {
        dpr: 1.25,
        shadowMapSize: 1024,
        anisotropy: 4,
        n8ao: false,
      },
      low: { dpr: 1, shadowMapSize: 512, anisotropy: 2, n8ao: false },
    });
  });

  it("requires WebGL2 and float color buffers before enabling N8AO", () => {
    expect(canEnableN8ao({ isWebGL2: true, hasColorBufferFloat: true })).toBe(
      true,
    );
    expect(canEnableN8ao({ isWebGL2: false, hasColorBufferFloat: true })).toBe(
      false,
    );
    expect(canEnableN8ao({ isWebGL2: true, hasColorBufferFloat: false })).toBe(
      false,
    );
  });

  it("uses an absolute 50 FPS decline floor without an incline band", () => {
    expect(performanceBounds()).toEqual([50, Number.POSITIVE_INFINITY]);
  });
});
