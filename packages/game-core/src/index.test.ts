import { describe, expect, it } from "vitest";
import {
  createGameSimulation,
  FIXED_DT,
  PHYSICS,
  TICKS_PER_SECOND,
} from "./index";

function command(hitPointLocal = { x: 0, y: 0, z: 0 }) {
  return {
    type: "SHOT" as const,
    matchId: "local-match",
    roundId: 1,
    turnId: 1,
    shotId: crypto.randomUUID(),
    direction: { x: 0, z: -1 },
    power01: 0.6,
    hitPointLocal,
  };
}

function outwardCommand(
  roundId: number,
  turnId: number,
  player: 0 | 1,
) {
  return {
    ...command(),
    roundId,
    turnId,
    shotId: crypto.randomUUID(),
    direction: { x: 0, z: player === 0 ? 1 : -1 },
    power01: 1,
  };
}

function stepUntil(
  simulation: Awaited<ReturnType<typeof createGameSimulation>>,
  predicate: () => boolean,
  maximumTicks = 5 * TICKS_PER_SECOND,
) {
  for (let tick = 0; tick < maximumTicks && !predicate(); tick += 1) {
    simulation.step();
  }
  expect(predicate()).toBe(true);
}

function stepUntilSettled(
  simulation: Awaited<ReturnType<typeof createGameSimulation>>,
) {
  stepUntil(
    simulation,
    () =>
      simulation.getPhase() === "AIMING" ||
      simulation.getPhase() === "ROUND_OVER" ||
      simulation.getPhase() === "MATCH_OVER",
  );
}

describe("GameSimulation", () => {
  it("uses the approved long-desk tactical physics profile", () => {
    expect(PHYSICS.tableHalfExtents).toEqual({ x: 0.42, y: 0.025, z: 0.65 });
    expect(PHYSICS.sharpenerMass).toBe(0.022);
    expect(PHYSICS.tableFriction).toBe(0.42);
    expect(PHYSICS.sharpenerFriction).toBe(0.42);
    expect(PHYSICS.maxImpulse).toBe(0.054);
  });

  it("advances exactly one 120 Hz tick per step", async () => {
    const simulation = await createGameSimulation();

    simulation.step();

    expect(FIXED_DT).toBe(1 / 120);
    expect(simulation.getSnapshot().tick).toBe(1);
    simulation.dispose();
  });

  it("accepts one legal shot and starts physical movement", async () => {
    const simulation = await createGameSimulation();

    expect(simulation.applyCommand(command())).toEqual({ accepted: true });
    simulation.step();

    const player = simulation.getSnapshot().sharpeners[0];
    expect(player.linearVelocity.z).toBeLessThan(-0.1);
    expect(simulation.getPhase()).toBe("MOVING");
    simulation.dispose();
  });

  it("produces more rotation for an off-center hit", async () => {
    const center = await createGameSimulation();
    const edge = await createGameSimulation();

    center.applyCommand(command());
    edge.applyCommand(command({ x: 0.018, y: 0, z: 0 }));
    center.step();
    edge.step();

    const centerSpin = center.getSnapshot().sharpeners[0].angularVelocity.y;
    const edgeSpin = edge.getSnapshot().sharpeners[0].angularVelocity.y;
    expect(Math.abs(edgeSpin)).toBeGreaterThan(Math.abs(centerSpin) + 0.1);
    center.dispose();
    edge.dispose();
  });

  it.each([
    [0.3078, 0.05, 0.12],
    [0.6132, 0.2, 0.35],
  ])(
    "settles tactical power %s within %s–%s metres",
    async (power01, minimum, maximum) => {
      const simulation = await createGameSimulation();
      const startX = simulation.getSnapshot().sharpeners[0].position.x;
      simulation.applyCommand({
        ...command(),
        direction: { x: 1, z: 0 },
        power01,
      });
      stepUntilSettled(simulation);

      const distance =
        simulation.getSnapshot().sharpeners[0].position.x - startX;
      expect(distance).toBeGreaterThanOrEqual(minimum);
      expect(distance).toBeLessThanOrEqual(maximum);
      simulation.dispose();
    },
  );

  it("rejects a hit point outside the authoritative collider", async () => {
    const simulation = await createGameSimulation();

    expect(
      simulation.applyCommand(command({ x: 0.2, y: 0, z: 0 })),
    ).toEqual({ accepted: false, reason: "ILLEGAL_HIT_POINT" });
    expect(simulation.getPhase()).toBe("AIMING");
    simulation.dispose();
  });

  it("passes an untouched turn when the aiming timer expires", async () => {
    const simulation = await createGameSimulation();

    for (let tick = 0; tick < 15 * TICKS_PER_SECOND; tick += 1) {
      simulation.step();
    }

    const snapshot = simulation.getSnapshot();
    expect(snapshot.activePlayer).toBe(1);
    expect(snapshot.phase).toBe("AIMING");
    expect(simulation.drainEvents()).toContainEqual({
      type: "TURN_PASSED",
      player: 0,
      reason: "TIMER_EXPIRED",
    });
    simulation.dispose();
  });

  it("lets a sharpener visibly fall before eliminating it at the death plane", async () => {
    const simulation = await createGameSimulation();
    simulation.applyCommand(outwardCommand(1, 1, 0));

    stepUntil(
      simulation,
      () =>
        simulation.getSnapshot().sharpeners[0].position.z >
        PHYSICS.tableHalfExtents.z + PHYSICS.sharpenerHalfExtents.z,
    );

    const falling = simulation.getSnapshot().sharpeners[0];
    expect(falling.position.y).toBeGreaterThan(PHYSICS.deathY);
    expect(falling.eliminated).toBe(false);
    expect(simulation.drainEvents()).toContainEqual({
      type: "FALL_STARTED",
      player: 0,
    });

    stepUntil(simulation, () => simulation.getPhase() === "ROUND_OVER");
    expect(simulation.getSnapshot().scores).toEqual([0, 1]);
    expect(simulation.drainEvents()).toEqual(
      expect.arrayContaining([
        { type: "SHARPENER_ELIMINATED", player: 0 },
        {
          type: "ROUND_ENDED",
          roundId: 1,
          winner: 1,
          reason: "KNOCKOUT",
        },
      ]),
    );
    simulation.dispose();
  });

  it("emits a normalized sharpener collision for feedback", async () => {
    const simulation = await createGameSimulation();
    simulation.applyCommand({
      ...command(),
      power01: 1,
    });

    const events = [];
    for (let tick = 0; tick < 3 * TICKS_PER_SECOND; tick += 1) {
      simulation.step();
      events.push(...simulation.drainEvents());
      if (
        events.some(
          (event) =>
            event.type === "CONTACT" &&
            event.kind === "SHARPENER_SHARPENER",
        )
      ) {
        break;
      }
    }

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "CONTACT",
        kind: "SHARPENER_SHARPENER",
        player: 0,
      }),
    );
    const contact = events.find((event) => event.type === "CONTACT");
    expect(contact && contact.type === "CONTACT" && contact.strength01).toBeGreaterThan(
      0,
    );
    expect(contact && contact.type === "CONTACT" && contact.strength01).toBeLessThanOrEqual(
      1,
    );
    simulation.dispose();
  });

  it("starts the next round after the knockout presentation window", async () => {
    const simulation = await createGameSimulation();
    simulation.applyCommand(outwardCommand(1, 1, 0));
    stepUntil(simulation, () => simulation.getPhase() === "ROUND_OVER");
    stepUntil(simulation, () => simulation.getSnapshot().roundId === 2);

    const nextRound = simulation.getSnapshot();
    expect(nextRound.phase).toBe("AIMING");
    expect(nextRound.activePlayer).toBe(1);
    expect(nextRound.scores).toEqual([0, 1]);
    expect(nextRound.sharpeners.every((body) => !body.eliminated)).toBe(true);
    simulation.dispose();
  });

  it("ends a best-of-five match when a player reaches three rounds", async () => {
    const simulation = await createGameSimulation();

    for (let round = 1; round <= 5; round += 1) {
      const snapshot = simulation.getSnapshot();
      const loser = snapshot.activePlayer;
      simulation.applyCommand(
        outwardCommand(snapshot.roundId, snapshot.turnId, loser),
      );
      stepUntil(
        simulation,
        () =>
          simulation.getPhase() === "ROUND_OVER" ||
          simulation.getPhase() === "MATCH_OVER",
      );
      if (simulation.getPhase() !== "MATCH_OVER") {
        stepUntil(simulation, () => simulation.getPhase() === "AIMING");
      }
    }

    const result = simulation.getSnapshot();
    expect(result.phase).toBe("MATCH_OVER");
    expect(result.scores).toEqual([2, 3]);
    expect(result.matchWinner).toBe(1);
    expect(simulation.drainEvents()).toContainEqual({
      type: "MATCH_ENDED",
      winner: 1,
    });
    simulation.dispose();
  });

  it("declares a drawn round after twenty settled shots", async () => {
    const simulation = await createGameSimulation();

    for (let shot = 1; shot <= PHYSICS.maxShotsPerRound; shot += 1) {
      const snapshot = simulation.getSnapshot();
      const result = simulation.applyCommand({
        ...command(),
        roundId: snapshot.roundId,
        turnId: snapshot.turnId,
        shotId: crypto.randomUUID(),
        direction: { x: 1, z: 0 },
        power01: 0.001,
      });
      expect(result).toEqual({ accepted: true });
      stepUntil(
        simulation,
        () =>
          simulation.getPhase() === "AIMING" ||
          simulation.getPhase() === "ROUND_OVER",
      );
    }

    const result = simulation.getSnapshot();
    expect(result.phase).toBe("ROUND_OVER");
    expect(result.roundWinner).toBeNull();
    expect(result.scores).toEqual([0, 0]);
    expect(simulation.drainEvents()).toContainEqual({
      type: "ROUND_ENDED",
      roundId: 1,
      winner: null,
      reason: "SHOT_LIMIT",
    });
    simulation.dispose();
  });
});
