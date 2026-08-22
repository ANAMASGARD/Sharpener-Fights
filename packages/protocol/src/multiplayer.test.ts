import { describe, expect, it } from "vitest";
import {
  GAME_VERSION,
  MatchActionSchema,
  MatchRecoveryResponseSchema,
  MatchUpdatedEventSchema,
  PROTOCOL_VERSION,
  ShotResolutionSchema,
  type PlaybackState,
} from "./index";

const playback: PlaybackState = {
  tick: 20,
  fighters: [
    {
      position: { x: 0, y: 0.013, z: 0.3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated: false,
      sleeping: true,
    },
    {
      position: { x: 0, y: 0.013, z: -0.3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated: false,
      sleeping: true,
    },
  ],
  phase: "AIMING",
  activePlayer: 1,
  roundScore: [1, 0],
  roundId: 2,
  turnId: 3,
  aimingTicksRemaining: 1_800,
  roundWinner: null,
  matchWinner: null,
  shotCount: 1,
};

const command = {
  type: "SHOT" as const,
  matchId: "room-1",
  roundId: 2,
  turnId: 3,
  shotId: "shot-1",
  direction: { x: 0, z: -1 },
  power01: 0.5,
  hitPointLocal: { x: 0, y: 0, z: 0 },
};

const resolution = {
  protocolVersion: PROTOCOL_VERSION,
  gameVersion: GAME_VERSION,
  roomId: "room-1",
  revision: 4,
  actionId: "action-4",
  player: 1 as const,
  command,
  startState: playback,
  finalState: playback,
  durationTicks: 120,
  timedEvents: [],
  finalStateHash: "a".repeat(64),
};

const view = {
  roomId: "room-1",
  mode: "FRIEND" as const,
  status: "PLAYING" as const,
  revision: 4,
  players: [],
  countdownEndsAtMs: null,
  reconnectDeadlineMs: null,
  turnDeadlineMs: 10_000,
  rematchVotes: [],
};

describe("serverless multiplayer protocol", () => {
  it("validates request-id-bearing actions without continuous aim state", () => {
    expect(
      MatchActionSchema.parse({
        type: "SHOT",
        requestId: "request-1",
        command,
      }),
    ).toMatchObject({ type: "SHOT", requestId: "request-1" });
    expect(
      MatchActionSchema.parse({
        type: "ADVANCE_DEADLINE",
        requestId: "request-2",
        expectedDeadlineKind: "TURN",
      }),
    ).toMatchObject({ expectedDeadlineKind: "TURN" });
    expect(MatchActionSchema.safeParse({ type: "AIM_UPDATE" }).success).toBe(false);
  });

  it("keeps internal checkpoints out of public playback resolutions", () => {
    const parsed = ShotResolutionSchema.parse(resolution);
    expect(parsed.actionId).toBe("action-4");
    expect(parsed).not.toHaveProperty("startCheckpoint");
    expect(parsed).not.toHaveProperty("finalCheckpoint");
  });

  it("requires action tracing on every server notification", () => {
    expect(
      MatchUpdatedEventSchema.parse({
        type: "MATCH_UPDATED",
        protocolVersion: PROTOCOL_VERSION,
        gameVersion: GAME_VERSION,
        roomId: "room-1",
        revision: 4,
        actionId: "action-4",
        finalStateHash: "a".repeat(64),
        view,
        resolution,
      }).actionId,
    ).toBe("action-4");
    expect(
      MatchUpdatedEventSchema.safeParse({
        type: "MATCH_UPDATED",
        protocolVersion: PROTOCOL_VERSION,
        gameVersion: GAME_VERSION,
        roomId: "room-1",
        revision: 4,
        finalStateHash: "a".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("validates delta and full recovery without exposing authority state", () => {
    expect(
      MatchRecoveryResponseSchema.parse({
        type: "DELTA",
        currentRevision: 4,
        view,
        resolutions: [resolution],
      }).type,
    ).toBe("DELTA");
    expect(
      MatchRecoveryResponseSchema.parse({
        type: "FULL",
        currentRevision: 4,
        view,
        playbackState: playback,
      }).type,
    ).toBe("FULL");
  });
});
