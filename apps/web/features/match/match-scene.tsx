"use client";

import { PerformanceMonitor, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { GameSnapshot, ShotCommand } from "@sharpener/protocol";
import type { AimPowerState } from "./aim-session";
import { ClassroomEnvironment } from "./classroom-environment";
import { HighTierEffects } from "./quality-effects";
import {
  RENDER_PROFILES,
  performanceBounds,
  type RenderQuality,
} from "./render-quality";
import type { MatchCosmetics } from "./sharpener-selector";
import { MatchFighter } from "./match-fighter";

function ResponsiveCamera() {
  const size = useThree((state) => state.size);
  const portrait = size.width / size.height < 0.82;
  return (
    <PerspectiveCamera
      makeDefault
      position={[0, portrait ? 2.82 : 2.28, portrait ? 2.78 : 2.38]}
      fov={portrait ? 38 : 40}
      near={0.01}
      far={12}
      onUpdate={(camera) => camera.lookAt(0, 0.02, -0.2)}
    />
  );
}

export function MatchScene({
  snapshot,
  cosmetics,
  sceneDate,
  onShoot,
  onAimPower,
  quality,
  effectsAvailable,
  interactionEpoch,
  onQualityDecline,
  onQualityFallback,
  onEffectsUnavailable,
}: {
  snapshot: GameSnapshot;
  cosmetics: MatchCosmetics;
  sceneDate: Date;
  onShoot: (command: ShotCommand) => void;
  onAimPower: (power: AimPowerState | null) => void;
  quality: RenderQuality;
  effectsAvailable: boolean;
  interactionEpoch: number;
  onQualityDecline: () => void;
  onQualityFallback: () => void;
  onEffectsUnavailable: () => void;
}) {
  const profile = RENDER_PROFILES[quality];
  return (
    <>
      <ResponsiveCamera />
      <PerformanceMonitor
        bounds={performanceBounds}
        iterations={8}
        ms={250}
        flipflops={3}
        onDecline={onQualityDecline}
        onFallback={onQualityFallback}
      />
      <ClassroomEnvironment
        snapshot={snapshot}
        cosmetics={cosmetics}
        profile={profile}
        sceneDate={sceneDate}
      />
      {snapshot.sharpeners.map((body) => (
        <MatchFighter
          key={`${body.player}-${snapshot.roundId}-${interactionEpoch}`}
          body={body}
          active={
            snapshot.phase === "AIMING" &&
            snapshot.activePlayer === body.player
          }
          snapshot={snapshot}
          cosmetic={cosmetics[body.player]}
          onShoot={onShoot}
          onAimPower={onAimPower}
        />
      ))}
      <HighTierEffects
        enabled={profile.n8ao && effectsAvailable}
        onUnavailable={onEffectsUnavailable}
      />
    </>
  );
}
