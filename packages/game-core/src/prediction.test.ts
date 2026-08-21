import { describe, expect, it } from "vitest";
import {
  createGameSimulation,
  createPredictionSimulation,
  type GameSnapshot,
} from "./index";

function shot(snapshot: GameSnapshot) {
  return {
    type: "SHOT" as const,
    matchId: snapshot.matchId,
    roundId: snapshot.roundId,
    turnId: snapshot.turnId,
    shotId: "predicted-shot",
    direction: { x: 0.6, z: -0.8 },
    power01: 0.7,
    hitPointLocal: { x: 0.012, y: 0, z: 0 },
  };
}

function expectBodiesClose(
  actual: GameSnapshot["sharpeners"],
  expected: GameSnapshot["sharpeners"],
) {
  for (const player of [0, 1] as const) {
    expect(actual[player]).toEqual(
      expect.objectContaining({
        player,
        eliminated: expected[player].eliminated,
        sleeping: expected[player].sleeping,
      }),
    );
    for (const key of ["position", "linearVelocity", "angularVelocity"] as const) {
      for (const axis of ["x", "y", "z"] as const) {
        expect(actual[player][key][axis]).toBeCloseTo(
          expected[player][key][axis],
          5,
        );
      }
    }
    for (const axis of ["x", "y", "z", "w"] as const) {
      expect(actual[player].rotation[axis]).toBeCloseTo(
        expected[player].rotation[axis],
        5,
      );
    }
  }
}

describe("PredictionSimulation", () => {
  it("uses the same shot physics as the authoritative simulation", async () => {
    const authority = await createGameSimulation({ matchId: "match-1" });
    const initial = authority.getSnapshot();
    const prediction = await createPredictionSimulation(initial);
    const command = shot(initial);

    expect(authority.applyCommand(command)).toEqual({ accepted: true });
    expect(prediction.applyPredictedShot(command)).toEqual({ accepted: true });
    authority.step();
    prediction.step();

    const authoritativeBody = authority.getSnapshot().sharpeners[0];
    const predictedBody = prediction.getSnapshot().sharpeners[0];
    expect(predictedBody.position).toEqual(authoritativeBody.position);
    expect(predictedBody.rotation).toEqual(authoritativeBody.rotation);
    expect(predictedBody.linearVelocity).toEqual(
      authoritativeBody.linearVelocity,
    );
    expect(predictedBody.angularVelocity).toEqual(
      authoritativeBody.angularVelocity,
    );

    prediction.dispose();
    authority.dispose();
  });

  it("restores authoritative bodies and match metadata in place", async () => {
    const authority = await createGameSimulation({ matchId: "match-1" });
    const baseline = authority.getSnapshot();
    const prediction = await createPredictionSimulation(baseline);

    authority.applyCommand(shot(baseline));
    for (let tick = 0; tick < 12; tick += 1) authority.step();
    const movingAuthority = authority.getSnapshot();

    prediction.restoreSnapshot(movingAuthority);

    expect(prediction.getSnapshot()).toEqual(
      expect.objectContaining({
        matchId: movingAuthority.matchId,
        tick: movingAuthority.tick,
        phase: movingAuthority.phase,
        roundId: movingAuthority.roundId,
        turnId: movingAuthority.turnId,
        activePlayer: movingAuthority.activePlayer,
        scores: movingAuthority.scores,
      }),
    );
    expectBodiesClose(prediction.getSnapshot().sharpeners, movingAuthority.sharpeners);
    prediction.step();
    expect(prediction.getSnapshot().tick).toBe(movingAuthority.tick + 1);
    expect(
      Number.isFinite(prediction.getSnapshot().sharpeners[0].position.x),
    ).toBe(true);
    prediction.dispose();
    authority.dispose();
  });

  it("rejects a prediction that does not match the authoritative turn", async () => {
    const authority = await createGameSimulation({ matchId: "match-1" });
    const baseline = authority.getSnapshot();
    const prediction = await createPredictionSimulation(baseline);

    expect(
      prediction.applyPredictedShot({ ...shot(baseline), turnId: 99 }),
    ).toEqual({ accepted: false, reason: "WRONG_TURN" });
    expect(prediction.getSnapshot()).toEqual(baseline);

    prediction.dispose();
    authority.dispose();
  });
});
