import { createPredictionSimulation, FIXED_DT } from "@sharpener/game-core";
import type {
  GameEvent,
  GameSnapshot,
  PlaybackState,
  ShotResolution,
} from "@sharpener/protocol";

export function playbackToSnapshot(roomId: string, state: PlaybackState): GameSnapshot {
  return {
    matchId: roomId,
    tick: state.tick,
    phase: state.phase,
    roundId: state.roundId,
    turnId: state.turnId,
    activePlayer: state.activePlayer,
    aimingTicksRemaining: state.aimingTicksRemaining,
    scores: [...state.roundScore],
    roundWinner: state.roundWinner,
    matchWinner: state.matchWinner,
    shotCount: state.shotCount,
    sharpeners: [
      { player: 0, ...state.fighters[0] },
      { player: 1, ...state.fighters[1] },
    ],
  };
}

export async function playResolution(input: {
  roomId: string;
  resolution: ShotResolution;
  onSnapshot(snapshot: GameSnapshot): void;
  onEvents(events: GameEvent[]): void;
  signal: AbortSignal;
}) {
  const prediction = await createPredictionSimulation(playbackToSnapshot(input.roomId, input.resolution.startState));
  if (input.signal.aborted) return prediction.dispose();
  const accepted = prediction.applyPredictedShot(input.resolution.command);
  if (!accepted.accepted) {
    prediction.dispose();
    input.onSnapshot(playbackToSnapshot(input.roomId, input.resolution.finalState));
    return;
  }
  const startedAt = performance.now();
  let simulatedTicks = 0;
  let eventIndex = 0;
  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      if (input.signal.aborted) return resolve();
      const target = Math.min(input.resolution.durationTicks, Math.floor((now - startedAt) / (FIXED_DT * 1_000)));
      let steps = 0;
      while (simulatedTicks < target && steps < 12) {
        prediction.step();
        simulatedTicks += 1;
        steps += 1;
      }
      const events: GameEvent[] = [];
      while (eventIndex < input.resolution.timedEvents.length && input.resolution.timedEvents[eventIndex].tickOffset <= simulatedTicks) {
        events.push(input.resolution.timedEvents[eventIndex].event);
        eventIndex += 1;
      }
      if (events.length) input.onEvents(events);
      input.onSnapshot(prediction.getSnapshot());
      if (simulatedTicks >= input.resolution.durationTicks) return resolve();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  prediction.dispose();
  if (!input.signal.aborted) input.onSnapshot(playbackToSnapshot(input.roomId, input.resolution.finalState));
}
