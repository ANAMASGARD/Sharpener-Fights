import { describe, expect, it, vi } from "vitest";
import { GameMediaAudio, type MediaElement } from "./media-audio";

class FakeAudio implements MediaElement {
  loop = false;
  preload = "none";
  volume = 1;
  currentTime = 0;
  paused = true;
  readonly play = vi.fn(async () => {
    this.paused = false;
  });
  readonly pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(readonly src: string) {}
}

function audioHarness({
  schedule,
}: {
  schedule?: (callback: () => void, delay: number) => () => void;
} = {}) {
  const elements = new Map<string, FakeAudio>();
  const director = new GameMediaAudio({
    createAudio: (src) => {
      const audio = new FakeAudio(src);
      elements.set(src, audio);
      return audio;
    },
    schedule,
  });
  return { director, elements };
}

describe("GameMediaAudio", () => {
  it("starts the playground track once at half volume and loops it", () => {
    const { director, elements } = audioHarness();

    director.setPreferences({ musicMuted: false, sfxMuted: false });
    director.unlock();

    const music = elements.get("/audio/PlayGround-BG.mp3");
    expect(music).toBeDefined();
    expect(music?.loop).toBe(true);
    expect(music?.volume).toBe(0.5);
    expect(music?.preload).toBe("auto");
    expect(music?.play).toHaveBeenCalledOnce();

    director.unlock();
    expect(music?.play).toHaveBeenCalledOnce();
  });

  it("mutes music and collision effects independently", () => {
    const { director, elements } = audioHarness();
    director.unlock();
    const music = elements.get("/audio/PlayGround-BG.mp3");
    const collision = elements.get("/audio/sharpener-collision.mp3");

    director.setPreferences({ musicMuted: true, sfxMuted: false });
    expect(music?.pause).toHaveBeenCalledOnce();
    director.playCollision(0.7);
    expect(collision?.currentTime).toBe(0);
    expect(collision?.volume).toBeCloseTo(0.56);
    expect(collision?.play).toHaveBeenCalledOnce();

    director.setPreferences({ musicMuted: false, sfxMuted: true });
    expect(music?.play).toHaveBeenCalledTimes(2);
    director.playCollision(1);
    expect(collision?.play).toHaveBeenCalledOnce();
  });

  it("plays both victory tracks once and cuts the winner effect at seven seconds", () => {
    let stopWinner: (() => void) | null = null;
    const cancel = vi.fn();
    const schedule = vi.fn((callback: () => void, delay: number) => {
      expect(delay).toBe(7_000);
      stopWinner = callback;
      return cancel;
    });
    const { director, elements } = audioHarness({ schedule });
    director.unlock();

    director.playVictory();
    director.playVictory();

    const bell = elements.get("/audio/School-Bell.mp3");
    const winner = elements.get("/audio/Winner-Effect.mp3");
    expect(bell?.play).toHaveBeenCalledOnce();
    expect(winner?.play).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledOnce();

    expect(stopWinner).not.toBeNull();
    (stopWinner as unknown as () => void)();
    expect(winner?.pause).toHaveBeenCalledOnce();
    expect(winner?.currentTime).toBe(0);
    expect(bell?.pause).not.toHaveBeenCalled();
  });

  it("stops active victory media when a replay begins", () => {
    const cancel = vi.fn();
    const { director, elements } = audioHarness({
      schedule: () => cancel,
    });
    director.unlock();
    director.playVictory();

    director.resetVictory();

    expect(cancel).toHaveBeenCalledOnce();
    expect(elements.get("/audio/School-Bell.mp3")?.pause).toHaveBeenCalledOnce();
    expect(elements.get("/audio/Winner-Effect.mp3")?.pause).toHaveBeenCalledOnce();
  });
});
