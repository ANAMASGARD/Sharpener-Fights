import {
  type CommandResult,
  type GameEvent,
  type GameSnapshot,
  type MatchPhase,
  type PlayerIndex,
  type ShotCommand,
} from "@sharpener/protocol";
import { PHYSICS, TICKS_PER_SECOND } from "./physics-config";
import { PhysicsWorld } from "./physics-world";
import { initializeRapier } from "./rapier";
import { validateShotCommand } from "./shot-validation";

export type MatchConfig = {
  matchId: string;
  startingPlayer: PlayerIndex;
};

export interface GameSimulation {
  reset(config?: Partial<MatchConfig>): void;
  applyCommand(command: ShotCommand): CommandResult;
  forfeit(loser: PlayerIndex): void;
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

class RapierGameSimulation implements GameSimulation {
  private physics!: PhysicsWorld;
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
    this.physics?.dispose();
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
    this.physics = new PhysicsWorld();
  }

  applyCommand(command: ShotCommand): CommandResult {
    const result = validateShotCommand(command, {
      matchId: this.config.matchId,
      roundId: this.roundId,
      turnId: this.turnId,
      phase: this.phase,
      hasSeenShot: (shotId) => this.seenShotIds.has(shotId),
      isLegalHitPoint: (point) => this.physics.isLegalHitPoint(point),
    });
    if (!result.accepted) return result;

    this.seenShotIds.add(command.shotId);
    this.physics.applyShot(this.activePlayer, command);
    this.shotCount += 1;
    this.phase = "MOVING";
    this.events.push(
      { type: "SHOT_ACCEPTED", player: this.activePlayer, shotId: command.shotId },
      { type: "PHASE_CHANGED", phase: "MOVING" },
    );
    return { accepted: true };
  }

  forfeit(loser: PlayerIndex) {
    if (this.phase === "MATCH_OVER") return;
    const winner: PlayerIndex = loser === 0 ? 1 : 0;
    this.matchWinner = winner;
    this.roundWinner = null;
    this.phase = "MATCH_OVER";
    this.events.push(
      { type: "MATCH_ENDED", winner, reason: "FORFEIT" },
      { type: "PHASE_CHANGED", phase: "MATCH_OVER" },
    );
  }

  step() {
    if (this.disposed) throw new Error("GameSimulation has been disposed");
    this.tick += 1;
    this.physics.step(this.tick, (event) => this.events.push(event));

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
    this.activePlayer = this.otherPlayer(this.activePlayer);
    this.turnId += 1;
    this.aimingDeadlineTick = this.tick + PHYSICS.aimingSeconds * TICKS_PER_SECOND;
    this.events.push({
      type: "TURN_PASSED",
      player: expiredPlayer,
      reason: "TIMER_EXPIRED",
    });
  }

  private updateEliminations() {
    for (const player of [0, 1] as const) {
      if (!this.eliminated[player] && this.physics.isBelowDeathPlane(player)) {
        this.eliminated[player] = true;
        this.events.push({ type: "SHARPENER_ELIMINATED", player });
      }
    }
  }

  private updateFalls() {
    for (const player of [0, 1] as const) {
      if (this.fallingStarted[player] || this.eliminated[player]) continue;
      if (this.physics.isUnsupportedAndFalling(player)) {
        this.fallingStarted[player] = true;
        this.events.push({ type: "FALL_STARTED", player });
      }
    }
  }

  private resolveEliminations() {
    const [playerZero, playerOne] = this.eliminated;
    if (!playerZero && !playerOne) return false;
    if (playerZero && playerOne) this.endRound(null, "DOUBLE_FALL");
    else this.endRound(playerZero ? 1 : 0, "KNOCKOUT");
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
        { type: "MATCH_ENDED", winner, reason: "SCORE" },
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
    this.roundId += 1;
    this.turnId += 1;
    const alternateStarter = this.otherPlayer(this.config.startingPlayer);
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
    this.physics.reset();
    this.events.push({ type: "PHASE_CHANGED", phase: "AIMING" });
  }

  private updateSettling() {
    if (!this.physics.areBodiesSettled()) {
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
      this.activePlayer = this.otherPlayer(this.activePlayer);
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
      sharpeners: [
        this.physics.getBodySnapshot(0, this.eliminated[0]),
        this.physics.getBodySnapshot(1, this.eliminated[1]),
      ],
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
    this.physics.dispose();
    this.disposed = true;
  }

  private otherPlayer(player: PlayerIndex): PlayerIndex {
    return player === 0 ? 1 : 0;
  }
}

export async function createGameSimulation(
  config?: Partial<MatchConfig>,
): Promise<GameSimulation> {
  await initializeRapier();
  return new RapierGameSimulation(config);
}
