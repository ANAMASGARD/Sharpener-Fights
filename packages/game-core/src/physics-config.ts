export const TICKS_PER_SECOND = 120;
export const FIXED_DT = 1 / TICKS_PER_SECOND;

export const PHYSICS = Object.freeze({
  gravity: -9.81,
  sharpenerMass: 0.022,
  sharpenerHalfExtents: Object.freeze({ x: 0.025, y: 0.012, z: 0.018 }),
  tableHalfExtents: Object.freeze({ x: 0.42, y: 0.025, z: 0.65 }),
  tableFriction: 0.42,
  sharpenerFriction: 0.42,
  tableRestitution: 0.08,
  sharpenerRestitution: 0.18,
  linearDamping: 0.12,
  angularDamping: 0.4,
  maxImpulse: 0.054,
  deathY: -0.45,
  aimingSeconds: 15,
  settledLinearSpeed: 0.03,
  settledAngularSpeed: 0.15,
  settledSeconds: 0.5,
  roundOverSeconds: 2,
  maxShotsPerRound: 20,
  scoreToWin: 3,
});
