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

  it("preloads selection and attack effects without autoplaying them", () => {
    const { director, elements } = audioHarness();

    director.unlock();

    const selection = elements.get("/audio/Selection-click.mp3");
    const attack = elements.get("/audio/Sharpener-click.mp3");
    const lockIn = elements.get("/audio/Lock-IN-sound.mp3");
    expect(selection?.preload).toBe("auto");
    expect(attack?.preload).toBe("auto");
    expect(lockIn?.preload).toBe("auto");
    expect(selection?.play).not.toHaveBeenCalled();
    expect(attack?.play).not.toHaveBeenCalled();
    expect(lockIn?.play).not.toHaveBeenCalled();
  });

  it("replays selection from the start and deduplicates attacks by shot id", () => {
    const { director, elements } = audioHarness();
    director.unlock();

    const selection = elements.get("/audio/Selection-click.mp3");
    const attack = elements.get("/audio/Sharpener-click.mp3");
    const lockIn = elements.get("/audio/Lock-IN-sound.mp3");
    if (!selection || !attack || !lockIn) throw new Error("expected effect media");
    selection.currentTime = 2;
    attack.currentTime = 3;
    lockIn.currentTime = 4;

    director.playSelection();
    director.playLockIn();
    director.playAttack("shot-1");
    director.playAttack("shot-1");
    director.playAttack("shot-2");

    expect(selection.currentTime).toBe(0);
    expect(selection.play).toHaveBeenCalledOnce();
    expect(lockIn.currentTime).toBe(0);
    expect(lockIn.play).toHaveBeenCalledOnce();
    expect(attack.currentTime).toBe(0);
    expect(attack.play).toHaveBeenCalledTimes(2);

    director.setPreferences({ musicMuted: false, sfxMuted: true });
    director.playSelection();
    director.playLockIn();
    director.playAttack("shot-3");
    expect(selection.play).toHaveBeenCalledOnce();
    expect(lockIn.play).toHaveBeenCalledOnce();
    expect(attack.play).toHaveBeenCalledTimes(2);
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
