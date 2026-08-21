import {
  GameSnapshotSchema,
  type CommandResult,
  type GameSnapshot,
  type ShotCommand,
} from "@sharpener/protocol";
import { PhysicsWorld } from "./physics-world";
import { initializeRapier } from "./rapier";
import { validateShotCommand } from "./shot-validation";

export interface PredictionSimulation {
  restoreSnapshot(snapshot: GameSnapshot): void;
  applyPredictedShot(command: ShotCommand): CommandResult;
  step(): void;
  getSnapshot(): GameSnapshot;
  dispose(): void;
}

class RapierPredictionSimulation implements PredictionSimulation {
  private readonly physics = new PhysicsWorld();
  private snapshot: GameSnapshot;
  private readonly seenShotIds = new Set<string>();
  private disposed = false;

  constructor(snapshot: GameSnapshot) {
    this.snapshot = GameSnapshotSchema.parse(snapshot);
    this.physics.restoreBodies(this.snapshot.sharpeners);
  }

  restoreSnapshot(snapshot: GameSnapshot) {
    this.assertActive();
    const parsed = GameSnapshotSchema.parse(snapshot);
    this.physics.restoreBodies(parsed.sharpeners);
    this.snapshot = parsed;
    this.seenShotIds.clear();
  }

  applyPredictedShot(command: ShotCommand): CommandResult {
    this.assertActive();
    const result = validateShotCommand(command, {
      matchId: this.snapshot.matchId,
      roundId: this.snapshot.roundId,
      turnId: this.snapshot.turnId,
      phase: this.snapshot.phase,
      hasSeenShot: (shotId) => this.seenShotIds.has(shotId),
      isLegalHitPoint: (point) => this.physics.isLegalHitPoint(point),
    });
    if (!result.accepted) return result;

    this.seenShotIds.add(command.shotId);
    this.physics.applyShot(this.snapshot.activePlayer, command);
    this.snapshot = {
      ...this.snapshot,
      phase: "MOVING",
      aimingTicksRemaining: 0,
      shotCount: this.snapshot.shotCount + 1,
    };
    return { accepted: true };
  }

  step() {
    this.assertActive();
    const tick = this.snapshot.tick + 1;
    this.physics.step(tick);
    this.snapshot = { ...this.snapshot, tick };
  }

  getSnapshot(): GameSnapshot {
    this.assertActive();
    return {
      ...this.snapshot,
      scores: [...this.snapshot.scores],
      sharpeners: [
        this.physics.getBodySnapshot(0, this.snapshot.sharpeners[0].eliminated),
        this.physics.getBodySnapshot(1, this.snapshot.sharpeners[1].eliminated),
      ],
    };
  }

  dispose() {
    if (this.disposed) return;
    this.physics.dispose();
    this.disposed = true;
  }

  private assertActive() {
    if (this.disposed) throw new Error("PredictionSimulation has been disposed");
  }
}

export async function createPredictionSimulation(
  snapshot: GameSnapshot,
): Promise<PredictionSimulation> {
  await initializeRapier();
  return new RapierPredictionSimulation(snapshot);
}
