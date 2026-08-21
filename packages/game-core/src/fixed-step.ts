import { FIXED_DT } from "./physics-config";

export type FixedStepOptions = {
  fixedDt?: number;
  maxCatchUpSteps: number;
  maxElapsedSeconds?: number;
};

export type FixedStepResult = {
  steps: number;
  droppedSeconds: number;
  overloaded: boolean;
};

const EPSILON = 1e-12;

export class FixedStepAccumulator {
  private accumulatedSeconds = 0;
  private readonly options: Required<FixedStepOptions>;

  constructor(options: FixedStepOptions) {
    this.options = {
      fixedDt: options.fixedDt ?? FIXED_DT,
      maxCatchUpSteps: options.maxCatchUpSteps,
      maxElapsedSeconds: options.maxElapsedSeconds ?? 0.25,
    };
    if (!Number.isFinite(this.options.fixedDt) || this.options.fixedDt <= 0) {
      throw new Error("fixedDt must be a positive finite number");
    }
    if (
      !Number.isInteger(this.options.maxCatchUpSteps) ||
      this.options.maxCatchUpSteps < 1
    ) {
      throw new Error("maxCatchUpSteps must be a positive integer");
    }
    if (
      !Number.isFinite(this.options.maxElapsedSeconds) ||
      this.options.maxElapsedSeconds <= 0
    ) {
      throw new Error("maxElapsedSeconds must be a positive finite number");
    }
  }

  advance(elapsedSeconds: number, step: () => void): FixedStepResult {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error("elapsedSeconds must be a non-negative finite number");
    }

    const acceptedElapsed = Math.min(
      elapsedSeconds,
      this.options.maxElapsedSeconds,
    );
    let droppedSeconds = elapsedSeconds - acceptedElapsed;
    this.accumulatedSeconds += acceptedElapsed;

    let steps = 0;
    while (
      this.accumulatedSeconds + EPSILON >= this.options.fixedDt &&
      steps < this.options.maxCatchUpSteps
    ) {
      step();
      this.accumulatedSeconds -= this.options.fixedDt;
      steps += 1;
    }

    if (this.accumulatedSeconds + EPSILON >= this.options.fixedDt) {
      const wholeBacklogSteps = Math.floor(
        (this.accumulatedSeconds + EPSILON) / this.options.fixedDt,
      );
      const backlogSeconds = wholeBacklogSteps * this.options.fixedDt;
      this.accumulatedSeconds -= backlogSeconds;
      droppedSeconds += backlogSeconds;
    }

    if (Math.abs(this.accumulatedSeconds) < EPSILON) {
      this.accumulatedSeconds = 0;
    }

    return {
      steps,
      droppedSeconds,
      overloaded: droppedSeconds > EPSILON,
    };
  }

  reset() {
    this.accumulatedSeconds = 0;
  }
}
