import type { GameEvent, GameSnapshot } from "@sharpener/protocol";
import { GameMediaAudio } from "./media-audio";

export type AudioCueName =
  | "flick"
  | "metal-click"
  | "wood-impact"
  | "floor-thud"
  | "fall-whoosh";

export type AudioCue =
  | { cue: "flick"; strength01: number; shotId: string }
  | {
      cue: Exclude<AudioCueName, "flick">;
      strength01: number;
    };

export type AudioPreferences = {
  sfxMuted: boolean;
  musicMuted: boolean;
};

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  sfxMuted: false,
  musicMuted: false,
};

const AUDIO_STORAGE_KEY = "sharpener-fights:audio";
type AudioStorage = Pick<Storage, "getItem" | "setItem">;

export function eventToAudioCue(event: GameEvent): AudioCue | null {
  if (event.type === "SHOT_ACCEPTED") {
    return { cue: "flick", strength01: 1, shotId: event.shotId };
  }
  if (event.type === "FALL_STARTED") {
    return { cue: "fall-whoosh", strength01: 1 };
  }
  if (event.type !== "CONTACT") return null;

  const cueByContact = {
    SHARPENER_SHARPENER: "metal-click",
    SHARPENER_TABLE: "wood-impact",
    SHARPENER_FLOOR: "floor-thud",
  } as const;
  return {
    cue: cueByContact[event.kind],
    strength01: event.strength01,
  };
}

export function readAudioPreferences(
  storage: Pick<AudioStorage, "getItem">,
): AudioPreferences {
  try {
    const value = JSON.parse(storage.getItem(AUDIO_STORAGE_KEY) ?? "null");
    if (
      value &&
      typeof value.sfxMuted === "boolean" &&
      (typeof value.musicMuted === "boolean" ||
        typeof value.ambienceMuted === "boolean")
    ) {
      return {
        sfxMuted: value.sfxMuted,
        musicMuted:
          typeof value.musicMuted === "boolean"
            ? value.musicMuted
            : value.ambienceMuted,
      };
    }
  } catch {
    // A corrupt preference must never block the game.
  }
  return DEFAULT_AUDIO_PREFERENCES;
}

export function writeAudioPreferences(
  storage: Pick<AudioStorage, "setItem">,
  preferences: AudioPreferences,
) {
  storage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(preferences));
}

class GameAudioDirector {
  private readonly media = new GameMediaAudio();
  private context: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private slideGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private preferences = DEFAULT_AUDIO_PREFERENCES;

  unlock() {
    this.media.unlock();
    if (typeof AudioContext === "undefined") return;
    if (this.context) {
      void this.context.resume();
      return;
    }

    const context = new AudioContext();
    const sfxGain = context.createGain();
    const ambienceGain = context.createGain();
    sfxGain.connect(context.destination);
    ambienceGain.connect(context.destination);
    this.context = context;
    this.sfxGain = sfxGain;
    this.ambienceGain = ambienceGain;
    this.noiseBuffer = this.createNoiseBuffer(context, 2);
    this.startAmbience();
    this.startSlideLoop();
    this.applyPreferences();
  }

  setPreferences(preferences: AudioPreferences) {
    this.preferences = preferences;
    this.media.setPreferences(preferences);
    this.applyPreferences();
  }

  handleEvents(events: readonly GameEvent[]) {
    for (const event of events) {
      const cue = eventToAudioCue(event);
      if (cue) this.play(cue);
    }
  }

  updateSlide(snapshot: GameSnapshot | null) {
    if (!this.context || !this.slideGain) return;
    const speed = snapshot
      ? Math.max(
          ...snapshot.sharpeners.map((body) =>
            body.position.y > -0.04 && body.position.y < 0.08
              ? Math.hypot(body.linearVelocity.x, body.linearVelocity.z)
              : 0,
          ),
        )
      : 0;
    const target = this.preferences.sfxMuted
      ? 0
      : Math.min(speed / 1.35, 1) * 0.035;
    this.slideGain.gain.setTargetAtTime(
      target,
      this.context.currentTime,
      0.045,
    );
  }

  playUiClick() {
    this.tone(560, 0.035, 0.035, "triangle", 760);
  }

  playSelectionClick() {
    this.media.playSelection();
  }

  playLockIn() {
    this.media.playLockIn();
  }

  playPredictedAttack(shotId: string) {
    this.media.playAttack(shotId);
  }

  playAcceptedAttack(shotId: string) {
    this.media.playAttack(shotId);
  }

  playVictory() {
    this.media.playVictory();
  }

  resetVictory() {
    this.media.resetVictory();
  }

  private applyPreferences() {
    if (!this.context) return;
    this.sfxGain?.gain.setTargetAtTime(
      this.preferences.sfxMuted ? 0 : 0.7,
      this.context.currentTime,
      0.02,
    );
    this.ambienceGain?.gain.setTargetAtTime(
      this.preferences.musicMuted ? 0 : 0.15,
      this.context.currentTime,
      0.08,
    );
  }

  private play(audioCue: AudioCue) {
    if (this.preferences.sfxMuted) return;
    if (audioCue.cue === "flick") {
      this.media.playAttack(audioCue.shotId);
      return;
    }
    const { cue, strength01 } = audioCue;
    const strength = Math.max(0.08, Math.min(strength01, 1));
    if (cue === "metal-click") {
      this.media.playCollision(strength);
      return;
    }
    if (!this.context) return;
    if (cue === "wood-impact") {
      this.tone(180 - strength * 45, 0.095, 0.08 * strength, "sine", 78);
      this.noise(0.07, 0.035 * strength, 720);
    } else if (cue === "floor-thud") {
      this.tone(92, 0.22, 0.15 * strength, "sine", 42);
      this.noise(0.12, 0.07 * strength, 380);
    } else {
      this.noise(0.4, 0.055, 980, 120);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
    endFrequency: number,
  ) {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(endFrequency, 1),
      now + duration,
    );
    gain.gain.setValueAtTime(Math.max(gainValue, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private noise(
    duration: number,
    gainValue: number,
    frequency: number,
    endFrequency = frequency,
  ) {
    if (!this.context || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(endFrequency, 1),
      now + duration,
    );
    gain.gain.setValueAtTime(Math.max(gainValue, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(now, Math.random() * 0.8, duration);
  }

  private createNoiseBuffer(context: AudioContext, seconds: number) {
    const buffer = context.createBuffer(
      1,
      context.sampleRate * seconds,
      context.sampleRate,
    );
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      channel[index] = last * 3.2;
    }
    return buffer;
  }

  private startAmbience() {
    if (!this.context || !this.ambienceGain || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 260;
    source.connect(filter).connect(this.ambienceGain);
    source.start();

    const fan = this.context.createOscillator();
    const fanGain = this.context.createGain();
    fan.type = "sine";
    fan.frequency.value = 54;
    fanGain.gain.value = 0.025;
    fan.connect(fanGain).connect(this.ambienceGain);
    fan.start();
  }

  private startSlideLoop() {
    if (!this.context || !this.sfxGain || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 920;
    filter.Q.value = 0.45;
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start();
    this.slideGain = gain;
  }
}

export const gameAudio = new GameAudioDirector();
