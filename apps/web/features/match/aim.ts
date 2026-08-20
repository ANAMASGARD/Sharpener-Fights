export type DeskPoint = { x: number; z: number };
export type LocalHitPoint = { x: number; y: number; z: number };

export const AIM = Object.freeze({
  maxDragDistance: 0.28,
  centerAssistRadius: 0.008,
});

export function progressivePower(value: number) {
  return Math.pow(value, 1.7);
}

export function calculateShot(
  start: DeskPoint,
  current: DeskPoint,
  maxDragDistance: number,
) {
  const x = start.x - current.x;
  const z = start.z - current.z;
  const rawDistance = Math.hypot(x, z);
  if (rawDistance < 0.008) return null;

  const distance = Math.min(rawDistance, maxDragDistance);
  return {
    direction: { x: x / rawDistance, z: z / rawDistance },
    power01: progressivePower(distance / maxDragDistance),
    drag01: distance / maxDragDistance,
  };
}

export function centerAssist(point: LocalHitPoint, radius: number) {
  const distance = Math.hypot(point.x, point.y, point.z);
  if (distance >= radius) return point;

  const centerWeight = 1 - distance / radius;
  const retained = 1 - centerWeight;
  return {
    x: point.x * retained,
    y: point.y * retained,
    z: point.z * retained,
  };
}

export function clampLocalHitPoint(
  point: LocalHitPoint,
  halfExtents: LocalHitPoint,
): LocalHitPoint {
  return {
    x: Math.max(-halfExtents.x, Math.min(halfExtents.x, point.x)),
    y: Math.max(-halfExtents.y, Math.min(halfExtents.y, point.y)),
    z: Math.max(-halfExtents.z, Math.min(halfExtents.z, point.z)),
  };
}
