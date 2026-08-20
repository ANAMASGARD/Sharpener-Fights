import RAPIER, {
  ActiveEvents,
  ColliderDesc,
  EventQueue,
  RigidBodyDesc,
  World,
  init,
  type RigidBody,
  type Rotation,
  type Vector,
} from "@dimforge/rapier3d-compat";
import {
  ShotCommandSchema,
  type BodySnapshot,
  type CommandResult,
  type GameEvent,
  type GameSnapshot,
  type MatchPhase,
  type PlayerIndex,
  type ShotCommand,
} from "@sharpener/protocol";

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

type ColliderRole =
  | { kind: "SHARPENER"; player: PlayerIndex }
  | { kind: "TABLE" }
  | { kind: "FLOOR" };

export type MatchConfig = {
  matchId: string;
  startingPlayer: PlayerIndex;
};

export interface GameSimulation {
  reset(config?: Partial<MatchConfig>): void;
  applyCommand(command: ShotCommand): CommandResult;
  step(): void;
  getSnapshot(): GameSnapshot;
  drainEvents(): GameEvent[];
  getPhase(): MatchPhase;
  dispose(): void;
}

const DEFAULT_CONFIG: MatchConfig = {
  matchId: "local-match",
  startingPlayer: 0,
};

let rapierReady: Promise<void> | undefined;

function initializeRapier() {
  rapierReady ??= init();
  return rapierReady;
}

function magnitude(vector: Vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function rotateVector(vector: Vector, rotation: Rotation): Vector {
  const { x, y, z, w } = rotation;
  const tx = 2 * (y * vector.z - z * vector.y);
  const ty = 2 * (z * vector.x - x * vector.z);
  const tz = 2 * (x * vector.y - y * vector.x);

  return {
    x: vector.x + w * tx + (y * tz - z * ty),
    y: vector.y + w * ty + (z * tx - x * tz),
    z: vector.z + w * tz + (x * ty - y * tx),
  };
}

class RapierGameSimulation implements GameSimulation {
  private world!: World;
  private eventQueue!: EventQueue;
  private sharpeners!: [RigidBody, RigidBody];
  private readonly colliderRoles = new Map<number, ColliderRole>();
  private readonly lastContactTick = new Map<string, number>();
  private config = DEFAULT_CONFIG;
  private tick = 0;
  private phase: MatchPhase = "AIMING";
  private roundId = 1;
  private turnId = 1;
  private activePlayer: PlayerIndex = 0;
  private aimingDeadlineTick = PHYSICS.aimingSeconds * TICKS_PER_SECOND;
  private scores: [number, number] = [0, 0];
  private roundWinner: PlayerIndex | null = null;
  private matchWinner: PlayerIndex | null = null;
  private roundOverDeadlineTick = 0;
  private shotCount = 0;
  private settledTicks = 0;
  private eliminated: [boolean, boolean] = [false, false];
  private fallingStarted: [boolean, boolean] = [false, false];
  private readonly seenShotIds = new Set<string>();
  private events: GameEvent[] = [];
  private disposed = false;

  constructor(config?: Partial<MatchConfig>) {
    this.reset(config);
  }

  reset(config: Partial<MatchConfig> = {}) {
    this.world?.free();
    this.eventQueue?.free();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tick = 0;
    this.phase = "AIMING";
    this.roundId = 1;
    this.turnId = 1;
    this.activePlayer = this.config.startingPlayer;
    this.aimingDeadlineTick = PHYSICS.aimingSeconds * TICKS_PER_SECOND;
    this.scores = [0, 0];
    this.roundWinner = null;
    this.matchWinner = null;
    this.roundOverDeadlineTick = 0;
    this.shotCount = 0;
    this.settledTicks = 0;
    this.eliminated = [false, false];
    this.fallingStarted = [false, false];
    this.events = [];
    this.seenShotIds.clear();
    this.disposed = false;

    this.createArena();
  }

  private createArena() {
    this.world = new World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.eventQueue = new EventQueue(true);
    this.colliderRoles.clear();
    this.lastContactTick.clear();
    this.world.timestep = FIXED_DT;

    const table = this.world.createRigidBody(RigidBodyDesc.fixed());
    const tableCollider = this.world.createCollider(
      ColliderDesc.cuboid(
        PHYSICS.tableHalfExtents.x,
        PHYSICS.tableHalfExtents.y,
        PHYSICS.tableHalfExtents.z,
      )
        .setTranslation(0, -PHYSICS.tableHalfExtents.y, 0)
        .setFriction(PHYSICS.tableFriction)
        .setRestitution(PHYSICS.tableRestitution),
      table,
    );
    this.colliderRoles.set(tableCollider.handle, { kind: "TABLE" });

    const floor = this.world.createRigidBody(RigidBodyDesc.fixed());
    const floorCollider = this.world.createCollider(
      ColliderDesc.cuboid(2.5, 0.02, 2.5)
        .setTranslation(0, -0.74, 0)
        .setFriction(0.7)
        .setRestitution(0.08),
      floor,
    );
    this.colliderRoles.set(floorCollider.handle, { kind: "FLOOR" });

    this.sharpeners = [this.createSharpener(0), this.createSharpener(1)];
  }

  private createSharpener(player: PlayerIndex) {
    const z = player === 0 ? 0.36 : -0.36;
    const body = this.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(0, PHYSICS.sharpenerHalfExtents.y + 0.001, z)
        .setLinearDamping(PHYSICS.linearDamping)
        .setAngularDamping(PHYSICS.angularDamping)
        .setCcdEnabled(true)
        .setCanSleep(true),
    );
    const collider = this.world.createCollider(
      ColliderDesc.roundCuboid(
        PHYSICS.sharpenerHalfExtents.x,
        PHYSICS.sharpenerHalfExtents.y,
        PHYSICS.sharpenerHalfExtents.z,
        0.002,
      )
        .setMass(PHYSICS.sharpenerMass)
        .setFriction(PHYSICS.sharpenerFriction)
        .setRestitution(PHYSICS.sharpenerRestitution)
        .setActiveEvents(ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(0.25),
      body,
    );
    this.colliderRoles.set(collider.handle, { kind: "SHARPENER", player });
    return body;
  }

  applyCommand(command: ShotCommand): CommandResult {
    const parsed = ShotCommandSchema.safeParse(command);
    if (!parsed.success) return { accepted: false, reason: "INVALID_COMMAND" };
    if (command.matchId !== this.config.matchId) {
      return { accepted: false, reason: "WRONG_MATCH" };
    }
    if (command.roundId !== this.roundId) {
      return { accepted: false, reason: "WRONG_ROUND" };
    }
    if (command.turnId !== this.turnId) {
      return { accepted: false, reason: "WRONG_TURN" };
    }
    if (this.phase !== "AIMING") {
      return { accepted: false, reason: "WRONG_PHASE" };
    }
    if (this.seenShotIds.has(command.shotId)) {
      return { accepted: false, reason: "DUPLICATE_SHOT" };
    }
    if (!this.isLegalHitPoint(command.hitPointLocal)) {
      return { accepted: false, reason: "ILLEGAL_HIT_POINT" };
    }

    this.seenShotIds.add(command.shotId);
    const body = this.sharpeners[this.activePlayer];
    const localPoint = command.hitPointLocal;
    const offset = rotateVector(localPoint, body.rotation());
    const position = body.translation();
    const impulse = PHYSICS.maxImpulse * command.power01;
    body.applyImpulseAtPoint(
      {
        x: command.direction.x * impulse,
        y: 0,
        z: command.direction.z * impulse,
      },
      {
        x: position.x + offset.x,
        y: position.y + offset.y,
        z: position.z + offset.z,
      },
      true,
    );

    this.shotCount += 1;
    this.phase = "MOVING";
    this.events.push(
      { type: "SHOT_ACCEPTED", player: this.activePlayer, shotId: command.shotId },
      { type: "PHASE_CHANGED", phase: "MOVING" },
    );
    return { accepted: true };
  }

  private isLegalHitPoint(point: Vector) {
    const tolerance = 0.002;
    const half = PHYSICS.sharpenerHalfExtents;
    return (
      Math.abs(point.x) <= half.x + tolerance &&
      Math.abs(point.y) <= half.y + tolerance &&
      Math.abs(point.z) <= half.z + tolerance
    );
  }

  step() {
    if (this.disposed) throw new Error("GameSimulation has been disposed");

    this.tick += 1;
    this.world.step(this.eventQueue);
    this.drainContactEvents();

    if (this.phase === "ROUND_OVER") {
      if (this.tick >= this.roundOverDeadlineTick) this.startNextRound();
      return;
    }

    if (this.phase === "MATCH_OVER") return;

    if (this.phase === "AIMING" && this.tick >= this.aimingDeadlineTick) {
      this.passTurnForExpiredTimer();
      return;
    }

    if (this.phase === "MOVING" || this.phase === "SETTLING") {
      this.updateFalls();
      this.updateEliminations();
      if (this.resolveEliminations()) return;
      this.updateSettling();
    }
  }

  private passTurnForExpiredTimer() {
    const expiredPlayer = this.activePlayer;
    this.activePlayer = this.activePlayer === 0 ? 1 : 0;
    this.turnId += 1;
    this.aimingDeadlineTick = this.tick + PHYSICS.aimingSeconds * TICKS_PER_SECOND;
    this.events.push({
      type: "TURN_PASSED",
      player: expiredPlayer,
      reason: "TIMER_EXPIRED",
    });
  }

  private updateEliminations() {
    this.sharpeners.forEach((body, player) => {
      const index = player as PlayerIndex;
      if (!this.eliminated[index] && body.translation().y < PHYSICS.deathY) {
        this.eliminated[index] = true;
        this.events.push({ type: "SHARPENER_ELIMINATED", player: index });
      }
    });
  }

  private updateFalls() {
    this.sharpeners.forEach((body, player) => {
      const index = player as PlayerIndex;
      if (this.fallingStarted[index] || this.eliminated[index]) return;
      const position = body.translation();
      const velocity = body.linvel();
      const unsupported =
        Math.abs(position.x) >
          PHYSICS.tableHalfExtents.x - PHYSICS.sharpenerHalfExtents.x ||
        Math.abs(position.z) >
          PHYSICS.tableHalfExtents.z - PHYSICS.sharpenerHalfExtents.z;
      if (unsupported && velocity.y < -0.03) {
        this.fallingStarted[index] = true;
        this.events.push({ type: "FALL_STARTED", player: index });
      }
    });
  }

  private drainContactEvents() {
    this.eventQueue.drainContactForceEvents((contact) => {
      const handle1 = contact.collider1();
      const handle2 = contact.collider2();
      const role1 = this.colliderRoles.get(handle1);
      const role2 = this.colliderRoles.get(handle2);
      if (!role1 || !role2) return;

      const key = handle1 < handle2
        ? `${handle1}:${handle2}`
        : `${handle2}:${handle1}`;
      const lastTick = this.lastContactTick.get(key) ?? -Infinity;
      if (this.tick - lastTick < 6) return;

      const sharpenerRoles = [role1, role2].filter(
        (role): role is Extract<ColliderRole, { kind: "SHARPENER" }> =>
          role.kind === "SHARPENER",
      );
      if (sharpenerRoles.length === 0) return;

      let kind: "SHARPENER_SHARPENER" | "SHARPENER_TABLE" | "SHARPENER_FLOOR";
      if (sharpenerRoles.length === 2) {
        kind = "SHARPENER_SHARPENER";
        sharpenerRoles.sort((a, b) => a.player - b.player);
      } else if (role1.kind === "FLOOR" || role2.kind === "FLOOR") {
        kind = "SHARPENER_FLOOR";
      } else {
        kind = "SHARPENER_TABLE";
      }

      const strength01 = Math.min(
        1,
        Math.max(0, (contact.totalForceMagnitude() - 0.25) / 4.75),
      );
      if (strength01 <= 0) return;
      this.lastContactTick.set(key, this.tick);
      this.events.push({
        type: "CONTACT",
        kind,
        player: sharpenerRoles[0].player,
        ...(sharpenerRoles[1]
          ? { otherPlayer: sharpenerRoles[1].player }
          : {}),
        strength01,
      });
    });
  }

  private resolveEliminations() {
    const [playerZero, playerOne] = this.eliminated;
    if (!playerZero && !playerOne) return false;
    if (playerZero && playerOne) {
      this.endRound(null, "DOUBLE_FALL");
    } else {
      this.endRound(playerZero ? 1 : 0, "KNOCKOUT");
    }
    return true;
  }

  private endRound(
    winner: PlayerIndex | null,
    reason: "KNOCKOUT" | "DOUBLE_FALL" | "SHOT_LIMIT",
  ) {
    this.roundWinner = winner;
    if (winner !== null) this.scores[winner] += 1;
    this.events.push({
      type: "ROUND_ENDED",
      roundId: this.roundId,
      winner,
      reason,
    });

    if (winner !== null && this.scores[winner] >= PHYSICS.scoreToWin) {
      this.matchWinner = winner;
      this.phase = "MATCH_OVER";
      this.events.push(
        { type: "MATCH_ENDED", winner },
        { type: "PHASE_CHANGED", phase: "MATCH_OVER" },
      );
      return;
    }

    this.phase = "ROUND_OVER";
    this.roundOverDeadlineTick =
      this.tick + PHYSICS.roundOverSeconds * TICKS_PER_SECOND;
    this.events.push({ type: "PHASE_CHANGED", phase: "ROUND_OVER" });
  }

  private startNextRound() {
    this.world.free();
    this.eventQueue.free();
    this.roundId += 1;
    this.turnId += 1;
    const alternateStarter = this.config.startingPlayer === 0 ? 1 : 0;
    this.activePlayer = this.roundId % 2 === 1
      ? this.config.startingPlayer
      : alternateStarter;
    this.phase = "AIMING";
    this.shotCount = 0;
    this.settledTicks = 0;
    this.eliminated = [false, false];
    this.fallingStarted = [false, false];
    this.roundWinner = null;
    this.roundOverDeadlineTick = 0;
    this.aimingDeadlineTick = this.tick + PHYSICS.aimingSeconds * TICKS_PER_SECOND;
    this.createArena();
    this.events.push({ type: "PHASE_CHANGED", phase: "AIMING" });
  }

  private updateSettling() {
    const allSlow = this.sharpeners.every(
      (body) =>
        magnitude(body.linvel()) < PHYSICS.settledLinearSpeed &&
        magnitude(body.angvel()) < PHYSICS.settledAngularSpeed,
    );

    if (!allSlow) {
      this.settledTicks = 0;
      if (this.phase === "SETTLING") this.phase = "MOVING";
      return;
    }

    if (this.phase === "MOVING") {
      this.phase = "SETTLING";
      this.events.push({ type: "PHASE_CHANGED", phase: "SETTLING" });
    }
    this.settledTicks += 1;

    if (this.settledTicks >= PHYSICS.settledSeconds * TICKS_PER_SECOND) {
      if (this.shotCount >= PHYSICS.maxShotsPerRound) {
        this.endRound(null, "SHOT_LIMIT");
        return;
      }
      this.activePlayer = this.activePlayer === 0 ? 1 : 0;
      this.turnId += 1;
      this.phase = "AIMING";
      this.settledTicks = 0;
      this.aimingDeadlineTick = this.tick + PHYSICS.aimingSeconds * TICKS_PER_SECOND;
      this.events.push({ type: "PHASE_CHANGED", phase: "AIMING" });
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      matchId: this.config.matchId,
      tick: this.tick,
      phase: this.phase,
      roundId: this.roundId,
      turnId: this.turnId,
      activePlayer: this.activePlayer,
      aimingTicksRemaining:
        this.phase === "AIMING"
          ? Math.max(0, this.aimingDeadlineTick - this.tick)
          : 0,
      scores: [...this.scores],
      roundWinner: this.roundWinner,
      matchWinner: this.matchWinner,
      shotCount: this.shotCount,
      sharpeners: [this.bodySnapshot(0), this.bodySnapshot(1)],
    };
  }

  private bodySnapshot(player: PlayerIndex): BodySnapshot {
    const body = this.sharpeners[player];
    const position = body.translation();
    const rotation = body.rotation();
    const linearVelocity = body.linvel();
    const angularVelocity = body.angvel();
    return {
      player,
      position: { ...position },
      rotation: { ...rotation },
      linearVelocity: { ...linearVelocity },
      angularVelocity: { ...angularVelocity },
      eliminated: this.eliminated[player],
    };
  }

  drainEvents() {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  getPhase() {
    return this.phase;
  }

  dispose() {
    if (this.disposed) return;
    this.world.free();
    this.eventQueue.free();
    this.disposed = true;
  }
}

export async function createGameSimulation(
  config?: Partial<MatchConfig>,
): Promise<GameSimulation> {
  await initializeRapier();
  return new RapierGameSimulation(config);
}

export { RAPIER };
export type {
  CommandResult,
  GameEvent,
  GameSnapshot,
  MatchPhase,
  PlayerIndex,
  ShotCommand,
};
