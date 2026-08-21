import {
  ActiveEvents,
  ColliderDesc,
  EventQueue,
  RigidBodyDesc,
  World,
  type RigidBody,
  type Rotation,
  type Vector,
} from "@dimforge/rapier3d-compat";
import type {
  BodySnapshot,
  GameEvent,
  PlayerIndex,
  ShotCommand,
} from "@sharpener/protocol";
import { FIXED_DT, PHYSICS } from "./physics-config";

type ColliderRole =
  | { kind: "SHARPENER"; player: PlayerIndex }
  | { kind: "TABLE" }
  | { kind: "FLOOR" };

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

export class PhysicsWorld {
  private world!: World;
  private eventQueue!: EventQueue;
  private sharpeners!: [RigidBody, RigidBody];
  private readonly colliderRoles = new Map<number, ColliderRole>();
  private readonly lastContactTick = new Map<string, number>();
  private disposed = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.releaseWorld();
    this.disposed = false;
    this.world = new World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.eventQueue = new EventQueue(true);
    this.world.timestep = FIXED_DT;
    this.colliderRoles.clear();
    this.lastContactTick.clear();
    this.createArena();
  }

  private createArena() {
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

  applyShot(player: PlayerIndex, command: ShotCommand) {
    const body = this.sharpeners[player];
    const offset = rotateVector(command.hitPointLocal, body.rotation());
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
  }

  step(tick: number, emit?: (event: GameEvent) => void) {
    this.assertActive();
    this.world.step(this.eventQueue);
    this.drainContactEvents(tick, emit);
  }

  isLegalHitPoint(point: Vector) {
    const tolerance = 0.002;
    const half = PHYSICS.sharpenerHalfExtents;
    return (
      Math.abs(point.x) <= half.x + tolerance &&
      Math.abs(point.y) <= half.y + tolerance &&
      Math.abs(point.z) <= half.z + tolerance
    );
  }

  isBelowDeathPlane(player: PlayerIndex) {
    return this.sharpeners[player].translation().y < PHYSICS.deathY;
  }

  isUnsupportedAndFalling(player: PlayerIndex) {
    const body = this.sharpeners[player];
    const position = body.translation();
    const unsupported =
      Math.abs(position.x) >
        PHYSICS.tableHalfExtents.x - PHYSICS.sharpenerHalfExtents.x ||
      Math.abs(position.z) >
        PHYSICS.tableHalfExtents.z - PHYSICS.sharpenerHalfExtents.z;
    return unsupported && body.linvel().y < -0.03;
  }

  areBodiesSettled() {
    return this.sharpeners.every(
      (body) =>
        magnitude(body.linvel()) < PHYSICS.settledLinearSpeed &&
        magnitude(body.angvel()) < PHYSICS.settledAngularSpeed,
    );
  }

  getBodySnapshot(player: PlayerIndex, eliminated: boolean): BodySnapshot {
    const body = this.sharpeners[player];
    return {
      player,
      position: { ...body.translation() },
      rotation: { ...body.rotation() },
      linearVelocity: { ...body.linvel() },
      angularVelocity: { ...body.angvel() },
      eliminated,
      sleeping: body.isSleeping(),
    };
  }

  restoreBodies(bodies: readonly [BodySnapshot, BodySnapshot]) {
    this.assertActive();
    this.lastContactTick.clear();
    for (const bodySnapshot of bodies) {
      const body = this.sharpeners[bodySnapshot.player];
      body.resetForces(false);
      body.resetTorques(false);
      body.setTranslation(bodySnapshot.position, false);
      body.setRotation(bodySnapshot.rotation, false);
      body.setLinvel(bodySnapshot.linearVelocity, false);
      body.setAngvel(bodySnapshot.angularVelocity, false);
      if (bodySnapshot.sleeping) body.sleep();
      else body.wakeUp();
    }
  }

  private drainContactEvents(tick: number, emit?: (event: GameEvent) => void) {
    this.eventQueue.drainContactForceEvents((contact) => {
      if (!emit) return;
      const handle1 = contact.collider1();
      const handle2 = contact.collider2();
      const role1 = this.colliderRoles.get(handle1);
      const role2 = this.colliderRoles.get(handle2);
      if (!role1 || !role2) return;

      const key = handle1 < handle2
        ? `${handle1}:${handle2}`
        : `${handle2}:${handle1}`;
      const lastTick = this.lastContactTick.get(key) ?? -Infinity;
      if (tick - lastTick < 6) return;

      const sharpenerRoles = [role1, role2].filter(
        (role): role is Extract<ColliderRole, { kind: "SHARPENER" }> =>
          role.kind === "SHARPENER",
      );
      if (sharpenerRoles.length === 0) return;

      const kind = sharpenerRoles.length === 2
        ? "SHARPENER_SHARPENER"
        : role1.kind === "FLOOR" || role2.kind === "FLOOR"
          ? "SHARPENER_FLOOR"
          : "SHARPENER_TABLE";
      if (sharpenerRoles.length === 2) {
        sharpenerRoles.sort((a, b) => a.player - b.player);
      }

      const strength01 = Math.min(
        1,
        Math.max(0, (contact.totalForceMagnitude() - 0.25) / 4.75),
      );
      if (strength01 <= 0) return;
      this.lastContactTick.set(key, tick);
      emit({
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

  dispose() {
    if (this.disposed) return;
    this.releaseWorld();
    this.disposed = true;
  }

  private releaseWorld() {
    this.world?.free();
    this.eventQueue?.free();
  }

  private assertActive() {
    if (this.disposed) throw new Error("PhysicsWorld has been disposed");
  }
}
