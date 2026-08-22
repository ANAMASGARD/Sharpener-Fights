"use client";

import { useCallback, useMemo, useState } from "react";
import type { GameSnapshot, ShotCommand } from "@sharpener/protocol";
import { visibleAimPower, type AimPowerState } from "./aim-session";
import { AudioMenu } from "./audio-menu";
import { gameAudio } from "./audio";
import { MatchArena } from "./match-arena";
import type { MatchFeed } from "./match-feed";
import { MatchHud } from "./match-hud";
import { worldDirectionToSeat, worldQuaternionToSeat, worldToSeatSpace } from "./presentation-space";
import { degradeRenderQuality, initialRenderQuality, type RenderQuality } from "./render-quality";
import type { MatchCosmetics } from "./sharpener-selector";
import { StaticClassroom } from "./static-classroom";
import { useGameAudio } from "./use-game-audio";
import { useAudioPreferences } from "./use-audio-preferences";
import { supportsWebGL } from "./webgl-support";
import styles from "./match-ui.module.css";

function presentSnapshot(snapshot: GameSnapshot | null, seat: 0 | 1) {
  if (!snapshot || seat === 0) return snapshot;
  return {
    ...snapshot,
    sharpeners: snapshot.sharpeners.map((body) => ({
      ...body,
      position: worldToSeatSpace(body.position, seat),
      rotation: worldQuaternionToSeat(body.rotation, seat),
      linearVelocity: worldDirectionToSeat(body.linearVelocity, seat),
      angularVelocity: worldDirectionToSeat(body.angularVelocity, seat),
    })) as GameSnapshot["sharpeners"],
  };
}

export function MatchView({ cosmetics, feed, onChangeSharpener }: {
  cosmetics: MatchCosmetics;
  feed: MatchFeed;
  onChangeSharpener: () => void;
}) {
  useGameAudio(feed.events, feed.snapshot, feed.acceptedShotId);
  const { preferences, toggleMusic, toggleSfx } = useAudioPreferences();
  const [aimPower, setAimPower] = useState<AimPowerState | null>(null);
  const [interactionEpoch, setInteractionEpoch] = useState(0);
  const [sceneDate] = useState(() => new Date());
  const [webglAvailable] = useState(supportsWebGL);
  const [quality, setQuality] = useState<RenderQuality>(() => initialRenderQuality({
    coarsePointer: typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    viewportWidth: typeof window === "undefined" ? 1440 : window.innerWidth,
  }));
  const [effectsAvailable, setEffectsAvailable] = useState(false);
  const snapshot = useMemo(() => presentSnapshot(feed.snapshot, feed.localSeat), [feed.localSeat, feed.snapshot]);
  const displayedAimPower = snapshot ? visibleAimPower(aimPower, snapshot.turnId) : 0;

  const shoot = useCallback((command: ShotCommand) => {
    if (feed.localSeat === 0) return feed.shoot(command);
    const direction = worldDirectionToSeat({ x: command.direction.x, y: 0, z: command.direction.z }, feed.localSeat);
    feed.shoot({ ...command, direction: { x: direction.x, z: direction.z } });
  }, [feed]);
  const resetMatch = useCallback(() => {
    gameAudio.resetVictory();
    setAimPower(null);
    setInteractionEpoch((value) => value + 1);
    feed.reset();
  }, [feed]);

  return (
    <main className={styles["game-shell"]}>
      <AudioMenu preferences={preferences} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx} />
      <section className={styles["game-stage"]} aria-label="Sharpener Fights classroom arena" data-phase={snapshot?.phase ?? "LOADING"} data-quality={quality}>
        <StaticClassroom snapshot={snapshot} cosmetics={cosmetics} sceneDate={sceneDate} />
        {webglAvailable && <MatchArena
          snapshot={snapshot} cosmetics={cosmetics} sceneDate={sceneDate} quality={quality}
          effectsAvailable={effectsAvailable} interactionEpoch={interactionEpoch}
          onShoot={shoot} onAimPower={setAimPower}
          onQualityDecline={() => setQuality((value) => degradeRenderQuality(value))}
          onQualityFallback={() => setQuality("low")}
          onEffectsCapability={(supported) => {
            setEffectsAvailable(supported);
            if (!supported) setQuality((value) => value === "high" ? "balanced" : value);
          }}
          onEffectsUnavailable={() => {
            setEffectsAvailable(false);
            setQuality((value) => value === "high" ? "balanced" : value);
          }}
        />}
        {!webglAvailable && <div className={styles["webgl-unavailable"]} role="status" aria-label="3D unavailable">
          <strong>Classroom preview</strong>
          <span>Enable WebGL or browser hardware acceleration, then reload to play.</span>
        </div>}
        <MatchHud snapshot={snapshot} aimPower={displayedAimPower} error={feed.error} localSeat={feed.online ? feed.localSeat : null}
          cosmetics={cosmetics} onChangeSharpener={onChangeSharpener} onReset={resetMatch} />
      </section>
    </main>
  );
}
