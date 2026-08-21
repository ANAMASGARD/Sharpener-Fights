import { describe, expect, it, vi } from "vitest";
import { FixedStepAccumulator } from "./index";

describe("FixedStepAccumulator", () => {
  it("defaults to the canonical 120 Hz step and 250 ms elapsed clamp", () => {
    const accumulator = new FixedStepAccumulator({ maxCatchUpSteps: 2 });
    const step = vi.fn();

    const result = accumulator.advance(0.5, step);

    expect(result.steps).toBe(2);
    expect(result.overloaded).toBe(true);
    expect(result.droppedSeconds).toBeCloseTo(0.4833333333, 8);
  });

  it("steps accumulated time at a fixed rate and retains the fractional remainder", () => {
    const accumulator = new FixedStepAccumulator({
      fixedDt: 0.1,
      maxCatchUpSteps: 4,
      maxElapsedSeconds: 0.5,
    });
    const step = vi.fn();

    expect(accumulator.advance(0.25, step)).toEqual({
      steps: 2,
      droppedSeconds: 0,
      overloaded: false,
    });
    expect(accumulator.advance(0.05, step)).toEqual({
      steps: 1,
      droppedSeconds: 0,
      overloaded: false,
    });
    expect(step).toHaveBeenCalledTimes(3);
  });

  it("bounds catch-up and reports discarded backlog", () => {
    const accumulator = new FixedStepAccumulator({
      fixedDt: 0.1,
      maxCatchUpSteps: 2,
      maxElapsedSeconds: 0.25,
    });
    const step = vi.fn();

    const result = accumulator.advance(0.55, step);

    expect(result.steps).toBe(2);
    expect(result.overloaded).toBe(true);
    expect(result.droppedSeconds).toBeCloseTo(0.3, 8);
    expect(step).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid timing configuration", () => {
    expect(
      () =>
        new FixedStepAccumulator({
          fixedDt: 0,
          maxCatchUpSteps: 12,
          maxElapsedSeconds: 0.25,
        }),
    ).toThrow("fixedDt");
  });
});
