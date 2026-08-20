import { describe, expect, it } from "vitest";
import type { GameEvent } from "@sharpener/protocol";
import {
  DEFAULT_AUDIO_PREFERENCES,
  eventToAudioCue,
  readAudioPreferences,
  writeAudioPreferences,
} from "./audio";

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("physics audio mapping", () => {
  it.each([
    ["SHARPENER_SHARPENER", "metal-click"],
    ["SHARPENER_TABLE", "wood-impact"],
    ["SHARPENER_FLOOR", "floor-thud"],
  ] as const)("maps %s contacts to %s", (kind, cue) => {
    const event: GameEvent = {
      type: "CONTACT",
      kind,
      player: 0,
      strength01: 0.65,
    };
    expect(eventToAudioCue(event)).toEqual({ cue, strength01: 0.65 });
  });

  it("maps shots and falls while ignoring presentation-only events", () => {
    expect(
      eventToAudioCue({ type: "FALL_STARTED", player: 1 }),
    ).toEqual({ cue: "fall-whoosh", strength01: 1 });
    expect(
      eventToAudioCue({ type: "SHOT_ACCEPTED", player: 0, shotId: "shot" }),
    ).toEqual({ cue: "flick", strength01: 1 });
    expect(eventToAudioCue({ type: "PHASE_CHANGED", phase: "MOVING" })).toBeNull();
  });
});

describe("audio preferences", () => {
  it("persists valid mute settings and rejects malformed storage", () => {
    const storage = memoryStorage();
    expect(readAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);

    writeAudioPreferences(storage, { sfxMuted: true, ambienceMuted: false });
    expect(readAudioPreferences(storage)).toEqual({
      sfxMuted: true,
      ambienceMuted: false,
    });

    expect(readAudioPreferences(memoryStorage("not-json"))).toEqual(
      DEFAULT_AUDIO_PREFERENCES,
    );
  });
});
