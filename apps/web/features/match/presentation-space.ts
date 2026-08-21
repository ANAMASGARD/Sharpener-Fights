import type { PlayerIndex } from "@sharpener/protocol";

export type PresentationVector = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type PresentationQuaternion = PresentationVector &
  Readonly<{ w: number }>;

export type PresentationEffectAnchor = Readonly<{
  position: PresentationVector;
  direction?: PresentationVector;
}>;

function copyVector(vector: PresentationVector): PresentationVector {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function copyQuaternion(
  quaternion: PresentationQuaternion,
): PresentationQuaternion {
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w,
  };
}

function rotateHalfTurn(vector: PresentationVector): PresentationVector {
  return { x: -vector.x, y: vector.y, z: -vector.z };
}

export function worldToSeatSpace(
  position: PresentationVector,
  seat: PlayerIndex,
): PresentationVector {
  return seat === 0 ? copyVector(position) : rotateHalfTurn(position);
}

export function seatSpaceToWorld(
  position: PresentationVector,
  seat: PlayerIndex,
): PresentationVector {
  return seat === 0 ? copyVector(position) : rotateHalfTurn(position);
}

export function worldDirectionToSeat(
  direction: PresentationVector,
  seat: PlayerIndex,
): PresentationVector {
  return seat === 0 ? copyVector(direction) : rotateHalfTurn(direction);
}

export function seatDirectionToWorld(
  direction: PresentationVector,
  seat: PlayerIndex,
): PresentationVector {
  return seat === 0 ? copyVector(direction) : rotateHalfTurn(direction);
}

export function worldQuaternionToSeat(
  rotation: PresentationQuaternion,
  seat: PlayerIndex,
): PresentationQuaternion {
  if (seat === 0) return copyQuaternion(rotation);
  return {
    x: rotation.z,
    y: rotation.w,
    z: -rotation.x,
    w: -rotation.y,
  };
}

export function seatQuaternionToWorld(
  rotation: PresentationQuaternion,
  seat: PlayerIndex,
): PresentationQuaternion {
  if (seat === 0) return copyQuaternion(rotation);
  return {
    x: -rotation.z,
    y: -rotation.w,
    z: rotation.x,
    w: rotation.y,
  };
}

export function worldEffectAnchorToSeat(
  anchor: PresentationEffectAnchor,
  seat: PlayerIndex,
): PresentationEffectAnchor {
  return {
    position: worldToSeatSpace(anchor.position, seat),
    ...(anchor.direction
      ? { direction: worldDirectionToSeat(anchor.direction, seat) }
      : {}),
  };
}

export function seatEffectAnchorToWorld(
  anchor: PresentationEffectAnchor,
  seat: PlayerIndex,
): PresentationEffectAnchor {
  return {
    position: seatSpaceToWorld(anchor.position, seat),
    ...(anchor.direction
      ? { direction: seatDirectionToWorld(anchor.direction, seat) }
      : {}),
  };
}
