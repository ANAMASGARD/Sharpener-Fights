import { describe, expect, it } from "vitest";
import { calculateShot, centerAssist } from "./aim";

describe("calculateShot", () => {
  it("launches opposite to a backward drag with progressive bounded power", () => {
    const shot = calculateShot(
      { x: 0, z: 0 },
      { x: 0, z: 0.14 },
      0.28,
    );

    expect(shot?.direction.x).toBeCloseTo(0);
    expect(shot?.direction.z).toBeCloseTo(-1);
    expect(shot?.power01).toBeCloseTo(0.3078, 3);
  });

  it.each([
    [0.25, 0.0947],
    [0.5, 0.3078],
    [0.75, 0.6132],
    [1, 1],
  ])("maps a %s drag to tactical power %s", (drag01, expected) => {
    const shot = calculateShot(
      { x: 0, z: 0 },
      { x: drag01 * 0.28, z: 0 },
      0.28,
    );

    expect(shot?.power01).toBeCloseTo(expected, 3);
  });

  it("cancels sub-threshold drags", () => {
    expect(
      calculateShot({ x: 0, z: 0 }, { x: 0.007, z: 0 }, 0.28),
    ).toBeNull();
  });
});

describe("centerAssist", () => {
  it("pulls central grabs toward center without changing edge grabs", () => {
    expect(centerAssist({ x: 0.002, y: 0, z: 0 }, 0.008).x).toBeCloseTo(
      0.0005,
    );
    expect(centerAssist({ x: 0.02, y: 0, z: 0 }, 0.008)).toEqual({
      x: 0.02,
      y: 0,
      z: 0,
    });
  });
});
