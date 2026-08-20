import { describe, expect, it, vi } from "vitest";
import {
  guardOptionalRender,
  installOptionalRenderGuard,
} from "./effect-fallback";

describe("guardOptionalRender", () => {
  it("reports the first frame failure once and turns later renders into no-ops", () => {
    const failure = new Error("shader failed");
    const render = vi.fn(() => {
      throw failure;
    });
    const onUnavailable = vi.fn();
    const guarded = guardOptionalRender(render, onUnavailable);

    guarded(0.016);
    guarded(0.016);

    expect(render).toHaveBeenCalledTimes(1);
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(onUnavailable).toHaveBeenCalledWith(failure);
  });

  it("forwards successful frames unchanged", () => {
    const render = vi.fn();
    const guarded = guardOptionalRender(render, vi.fn());

    guarded(0.016);

    expect(render).toHaveBeenCalledWith(0.016);
  });
});

describe("installOptionalRenderGuard", () => {
  it("patches a live composer target and restores its original method", () => {
    const failure = new Error("framebuffer failed");
    const onUnavailable = vi.fn();
    const target = {
      render: vi.fn((deltaTime: number) => {
        expect(deltaTime).toBeGreaterThan(0);
        throw failure;
      }),
    };
    const originalRender = target.render;

    const restore = installOptionalRenderGuard(target, onUnavailable);
    expect(target.render).not.toBe(originalRender);
    target.render(0.016);
    target.render(0.016);
    expect(originalRender).toHaveBeenCalledOnce();
    expect(onUnavailable).toHaveBeenCalledWith(failure);

    restore();
    expect(target.render).toBe(originalRender);
  });
});
