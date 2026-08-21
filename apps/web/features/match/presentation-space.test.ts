import { describe, expect, it } from "vitest";
import {
  seatDirectionToWorld,
  seatEffectAnchorToWorld,
  seatQuaternionToWorld,
  seatSpaceToWorld,
  worldDirectionToSeat,
  worldEffectAnchorToSeat,
  worldQuaternionToSeat,
  worldToSeatSpace,
} from "./presentation-space";

describe("seat presentation space", () => {
  it("keeps Seat A positions, directions, rotations, and effects in world space", () => {
    const position = { x: 0.4, y: 0.03, z: -0.7 };
    const direction = { x: 0.6, y: 0, z: -0.8 };
    const rotation = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 };
    const effect = { position, direction };

    expect(worldToSeatSpace(position, 0)).toEqual(position);
    expect(worldDirectionToSeat(direction, 0)).toEqual(direction);
    expect(worldQuaternionToSeat(rotation, 0)).toEqual(rotation);
    expect(worldEffectAnchorToSeat(effect, 0)).toEqual(effect);
  });

  it("rotates Seat B positions, directions, rotations, and effects 180 degrees", () => {
    const position = { x: 0.4, y: 0.03, z: -0.7 };
    const direction = { x: 0.6, y: 0, z: -0.8 };
    const rotation = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 };

    expect(worldToSeatSpace(position, 1)).toEqual({
      x: -0.4,
      y: 0.03,
      z: 0.7,
    });
    expect(worldDirectionToSeat(direction, 1)).toEqual({
      x: -0.6,
      y: 0,
      z: 0.8,
    });
    expect(worldQuaternionToSeat(rotation, 1)).toEqual({
      x: 0.3,
      y: 0.9,
      z: -0.1,
      w: -0.2,
    });
    expect(worldEffectAnchorToSeat({ position, direction }, 1)).toEqual({
      position: { x: -0.4, y: 0.03, z: 0.7 },
      direction: { x: -0.6, y: 0, z: 0.8 },
    });
  });

  it.each([0, 1] as const)(
    "round-trips Seat %s positions, directions, rotations, and effect anchors",
    (seat) => {
      const position = { x: -0.37, y: 0.08, z: 0.61 };
      const direction = { x: -0.8, y: 0.1, z: 0.6 };
      const rotation = { x: 0.12, y: -0.48, z: 0.23, w: 0.84 };
      const effect = { position, direction };

      expect(seatSpaceToWorld(worldToSeatSpace(position, seat), seat)).toEqual(
        position,
      );
      expect(
        seatDirectionToWorld(worldDirectionToSeat(direction, seat), seat),
      ).toEqual(direction);
      expect(
        seatQuaternionToWorld(worldQuaternionToSeat(rotation, seat), seat),
      ).toEqual(rotation);
      expect(
        seatEffectAnchorToWorld(worldEffectAnchorToSeat(effect, seat), seat),
      ).toEqual(effect);
    },
  );
});
