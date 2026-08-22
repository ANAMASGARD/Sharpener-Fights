import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_VERSION,
  createGameSimulation,
  createGameSimulationFromCheckpoint,
  TICKS_PER_SECOND,
} from "./index";

describe("GameSimulation checkpoints", () => {
  it("restores rules and rigid-body state without request idempotency metadata", async () => {
    const original = await createGameSimulation({ matchId: "match-checkpoint" });
    const command = {
      type: "SHOT" as const,
      matchId: "match-checkpoint",
      roundId: 1,
      turnId: 1,
      shotId: "shot-checkpoint",
      direction: { x: 0, z: -1 },
      power01: 0.45,
      hitPointLocal: { x: 0.012, y: 0, z: 0 },
    };
    expect(original.applyCommand(command)).toEqual({ accepted: true });
    for (
      let tick = 0;
      tick < 5 * TICKS_PER_SECOND && original.getPhase() !== "AIMING";
      tick += 1
    ) {
      original.step();
    }

    const checkpoint = original.createCheckpoint();
    expect(checkpoint.checkpointVersion).toBe(CHECKPOINT_VERSION);
    expect(checkpoint).not.toHaveProperty("seenShotIds");

    const restored = await createGameSimulationFromCheckpoint(checkpoint);
    const duplicateRestore = await createGameSimulationFromCheckpoint(checkpoint);
    expect(restored.getSnapshot()).toMatchObject({
      matchId: original.getSnapshot().matchId,
      tick: original.getSnapshot().tick,
      phase: original.getSnapshot().phase,
      roundId: original.getSnapshot().roundId,
      turnId: original.getSnapshot().turnId,
      scores: original.getSnapshot().scores,
    });

    restored.step();
    duplicateRestore.step();
    expect(restored.getSnapshot()).toEqual(duplicateRestore.getSnapshot());
    original.dispose();
    restored.dispose();
    duplicateRestore.dispose();
  });

  it("expires only the current aiming turn through the rules authority", async () => {
    const simulation = await createGameSimulation({ matchId: "deadline-match" });

    expect(simulation.expireTurn()).toBe(true);
    expect(simulation.getSnapshot()).toMatchObject({
      activePlayer: 1,
      turnId: 2,
      phase: "AIMING",
    });
    expect(simulation.expireTurn(0)).toBe(false);
    simulation.dispose();
  });

  it("rejects unsupported checkpoint versions", async () => {
    const simulation = await createGameSimulation();
    const checkpoint = simulation.createCheckpoint();
    simulation.dispose();

    await expect(
      createGameSimulationFromCheckpoint({
        ...checkpoint,
        checkpointVersion: CHECKPOINT_VERSION + 1,
      }),
    ).rejects.toThrow("Unsupported game checkpoint version");
  });
});
