"use client";

import { Canvas } from "@react-three/fiber";
import { AgXToneMapping, PCFSoftShadowMap } from "three";
import type { GameSnapshot, ShotCommand } from "@sharpener/protocol";
import type { AimPowerState } from "./aim-session";
import {
  RENDER_PROFILES,
  canEnableN8ao,
  type RenderQuality,
} from "./render-quality";
import type { MatchCosmetics } from "./sharpener-selector";
import { MatchScene } from "./match-scene";
import styles from "./match-ui.module.css";

export function MatchArena({
  snapshot,
  cosmetics,
  sceneDate,
  quality,
  effectsAvailable,
  interactionEpoch,
  onShoot,
  onAimPower,
  onQualityDecline,
  onQualityFallback,
  onEffectsCapability,
  onEffectsUnavailable,
}: {
  snapshot: GameSnapshot | null;
  cosmetics: MatchCosmetics;
  sceneDate: Date;
  quality: RenderQuality;
  effectsAvailable: boolean;
  interactionEpoch: number;
  onShoot: (command: ShotCommand) => void;
  onAimPower: (power: AimPowerState | null) => void;
  onQualityDecline: () => void;
  onQualityFallback: () => void;
  onEffectsCapability: (supported: boolean) => void;
  onEffectsUnavailable: () => void;
}) {
  const profile = RENDER_PROFILES[quality];

  return (
    <Canvas
      className={styles["arena-canvas"]}
      data-layer="arena-canvas"
      shadows={{ type: PCFSoftShadowMap }}
      dpr={profile.dpr}
      camera={{ position: [0, 2.28, 2.38], fov: 40, near: 0.01, far: 12 }}
      gl={{
        antialias: true,
        powerPreference: "default",
        toneMapping: AgXToneMapping,
        toneMappingExposure: 1.05,
      }}
      onCreated={({ gl }) => {
        const context = gl.getContext();
        onEffectsCapability(
          canEnableN8ao({
            isWebGL2: gl.capabilities.isWebGL2,
            hasColorBufferFloat: Boolean(
              context.getExtension("EXT_color_buffer_float"),
            ),
          }),
        );
      }}
    >
      {snapshot && (
        <MatchScene
          snapshot={snapshot}
          cosmetics={cosmetics}
          sceneDate={sceneDate}
          onShoot={onShoot}
          onAimPower={onAimPower}
          quality={quality}
          effectsAvailable={effectsAvailable}
          interactionEpoch={interactionEpoch}
          onQualityDecline={onQualityDecline}
          onQualityFallback={onQualityFallback}
          onEffectsUnavailable={onEffectsUnavailable}
        />
      )}
    </Canvas>
  );
}
