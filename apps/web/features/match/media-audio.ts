import type { AudioPreferences } from "./audio";

export type MediaElement = {
  readonly src: string;
  loop: boolean;
  preload: string;
  volume: number;
  currentTime: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
};

type MediaAudioOptions = {
  createAudio?: (src: string) => MediaElement;
  schedule?: (callback: () => void, delay: number) => () => void;
};

function ignorePlaybackRejection(playback: Promise<void>) {
  void playback.catch(() => {
    // Browser policy or a missing optional asset must never stop the match.
  });
}

export class GameMediaAudio {
  private static readonly MAX_RECENT_ATTACKS = 128;
  private readonly createAudio: (src: string) => MediaElement;
  private readonly schedule: (callback: () => void, delay: number) => () => void;
  private music: MediaElement | null = null;
  private selection: MediaElement | null = null;
  private lockIn: MediaElement | null = null;
  private attack: MediaElement | null = null;
  private collision: MediaElement | null = null;
  private bell: MediaElement | null = null;
  private winner: MediaElement | null = null;
  private cancelWinnerStop: (() => void) | null = null;
  private readonly recentAttackShotIds = new Set<string>();
  private victoryActive = false;
  private unlocked = false;
  private preferences: AudioPreferences = {
    musicMuted: false,
    sfxMuted: false,
  };

  constructor({
    createAudio = (src) => new Audio(src),
    schedule = (callback, delay) => {
      const timer = window.setTimeout(callback, delay);
      return () => window.clearTimeout(timer);
    },
  }: MediaAudioOptions = {}) {
    this.createAudio = createAudio;
    this.schedule = schedule;
  }

  setPreferences(preferences: AudioPreferences) {
    this.preferences = preferences;
    if (!this.music) return;
    if (preferences.musicMuted) {
      this.music.pause();
    } else if (this.unlocked && this.music.paused) {
      ignorePlaybackRejection(this.music.play());
    }
    if (preferences.sfxMuted) {
      this.selection?.pause();
      this.lockIn?.pause();
      this.attack?.pause();
      this.collision?.pause();
      this.resetVictory();
    }
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.music = this.createAudio("/audio/PlayGround-BG.mp3");
    this.music.loop = true;
    this.music.preload = "auto";
    this.music.volume = 0.5;
    this.selection = this.createAudio("/audio/Selection-click.mp3");
    this.selection.preload = "auto";
    this.selection.volume = 0.56;
    this.lockIn = this.createAudio("/audio/Lock-IN-sound.mp3");
    this.lockIn.preload = "auto";
    this.lockIn.volume = 0.64;
    this.attack = this.createAudio("/audio/Sharpener-click.mp3");
    this.attack.preload = "auto";
    this.attack.volume = 0.72;
    this.collision = this.createAudio("/audio/sharpener-collision.mp3");
    this.collision.preload = "auto";
    this.bell = this.createAudio("/audio/School-Bell.mp3");
    this.bell.preload = "auto";
    this.bell.volume = 0.72;
    this.winner = this.createAudio("/audio/Winner-Effect.mp3");
    this.winner.preload = "auto";
    this.winner.volume = 0.68;
    if (!this.preferences.musicMuted) {
      ignorePlaybackRejection(this.music.play());
    }
  }

  playSelection() {
    if (!this.selection || this.preferences.sfxMuted) return;
    this.selection.currentTime = 0;
    ignorePlaybackRejection(this.selection.play());
  }

  playLockIn() {
    if (!this.lockIn || this.preferences.sfxMuted) return;
    this.lockIn.currentTime = 0;
    ignorePlaybackRejection(this.lockIn.play());
  }

  playAttack(shotId: string) {
    if (this.recentAttackShotIds.has(shotId)) return;
    this.recentAttackShotIds.add(shotId);
    if (
      this.recentAttackShotIds.size > GameMediaAudio.MAX_RECENT_ATTACKS
    ) {
      const oldest = this.recentAttackShotIds.values().next().value;
      if (oldest !== undefined) this.recentAttackShotIds.delete(oldest);
    }
    if (!this.attack || this.preferences.sfxMuted) return;
    this.attack.currentTime = 0;
    ignorePlaybackRejection(this.attack.play());
  }

  playCollision(strength01: number) {
    if (!this.collision || this.preferences.sfxMuted) return;
    const strength = Math.max(0.12, Math.min(strength01, 1));
    this.collision.currentTime = 0;
    this.collision.volume = strength * 0.8;
    ignorePlaybackRejection(this.collision.play());
  }

  playVictory() {
    if (
      !this.bell ||
      !this.winner ||
      this.preferences.sfxMuted ||
      this.victoryActive
    ) {
      return;
    }
    this.victoryActive = true;
    this.bell.currentTime = 0;
    this.winner.currentTime = 0;
    ignorePlaybackRejection(this.bell.play());
    ignorePlaybackRejection(this.winner.play());
    this.cancelWinnerStop = this.schedule(() => {
      this.winner?.pause();
      if (this.winner) this.winner.currentTime = 0;
      this.cancelWinnerStop = null;
    }, 7_000);
  }

  resetVictory() {
    this.cancelWinnerStop?.();
    this.cancelWinnerStop = null;
    for (const audio of [this.bell, this.winner]) {
      audio?.pause();
      if (audio) audio.currentTime = 0;
    }
    this.victoryActive = false;
  }
}
