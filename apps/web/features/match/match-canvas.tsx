"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Line, PerformanceMonitor, PerspectiveCamera } from "@react-three/drei";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AgXToneMapping,
  Group,
  PCFSoftShadowMap,
  Plane,
  Quaternion,
  Vector3,
} from "three";
import type { BodySnapshot, GameSnapshot, ShotCommand } from "@sharpener/protocol";
import { PHYSICS, TICKS_PER_SECOND } from "@sharpener/game-core";
import {
  AIM,
  calculateShot,
  centerAssist,
  clampLocalHitPoint,
  type DeskPoint,
  type LocalHitPoint,
} from "./aim";
import {
  hasShotAuthority,
  visibleAimPower,
  type AimPowerState,
  type ShotAuthority,
} from "./aim-session";
import { ClassroomEnvironment } from "./classroom-environment";
import { SharpenerModel } from "./sharpener-model";
import type { MatchCosmetics } from "./sharpener-selector";
import { useGameWorker } from "./use-game-worker";
import { useGameAudio } from "./use-game-audio";
import { StaticClassroom } from "./static-classroom";
import { supportsWebGL } from "./webgl-support";
import {
  RENDER_PROFILES,
  canEnableN8ao,
  degradeRenderQuality,
  initialRenderQuality,
  performanceBounds,
  type RenderQuality,
} from "./render-quality";
import { HighTierEffects } from "./quality-effects";
import { gameAudio } from "./audio";
import { createMatchSummary } from "./match-summary";
import styles from "./match-ui.module.css";

type DragState = {
  pointerId: number;
  start: DeskPoint;
  current: DeskPoint;
  hitPointLocal: LocalHitPoint;
  authority: ShotAuthority;
};

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

function SharpenerFighter({
  body,
  active,
  snapshot,
  cosmetic,
  onShoot,
  onAimPower,
}: {
  body: BodySnapshot;
  active: boolean;
  snapshot: GameSnapshot;
  cosmetic: MatchCosmetics[number];
  onShoot: (command: ShotCommand) => void;
  onAimPower: (power: AimPowerState | null) => void;
}) {
  const group = useRef<Group>(null);
  const initialized = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const targetPosition = useMemo(() => new Vector3(), []);
  const targetRotation = useMemo(() => new Quaternion(), []);
  const deskPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);

  useFrame((_, delta) => {
    if (!group.current) return;
    targetPosition.set(body.position.x, body.position.y, body.position.z);
    targetRotation.set(
      body.rotation.x,
      body.rotation.y,
      body.rotation.z,
      body.rotation.w,
    );
    if (!initialized.current) {
      group.current.position.copy(targetPosition);
      group.current.quaternion.copy(targetRotation);
      initialized.current = true;
      return;
    }
    const smoothing = 1 - Math.exp(-22 * delta);
    group.current.position.lerp(targetPosition, smoothing);
    group.current.quaternion.slerp(targetRotation, smoothing);
  });

  function planePoint(event: ThreeEvent<PointerEvent>) {
    const point = new Vector3();
    return event.ray.intersectPlane(deskPlane, point) ? point : null;
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (!active || !group.current) return;
    event.stopPropagation();
    const point = planePoint(event);
    if (!point) return;
    const local = group.current.worldToLocal(event.point.clone());
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      start: { x: point.x, z: point.z },
      current: { x: point.x, z: point.z },
      hitPointLocal: centerAssist(
        clampLocalHitPoint(
          { x: local.x, y: local.y, z: local.z },
          PHYSICS.sharpenerHalfExtents,
        ),
        AIM.centerAssistRadius,
      ),
      authority: {
        matchId: snapshot.matchId,
        roundId: snapshot.roundId,
        turnId: snapshot.turnId,
        player: body.player,
      },
    });
    onAimPower({ turnId: snapshot.turnId, power01: 0 });
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    if (!hasShotAuthority(drag.authority, snapshot)) {
      setDrag(null);
      onAimPower(null);
      return;
    }
    const point = planePoint(event);
    if (!point) return;
    const current = { x: point.x, z: point.z };
    setDrag((value) => (value ? { ...value, current } : value));
    onAimPower({
      turnId: drag.authority.turnId,
      power01:
        calculateShot(drag.start, current, AIM.maxDragDistance)?.power01 ??
        0,
    });
  }

  function release(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    const shot = calculateShot(
      drag.start,
      drag.current,
      AIM.maxDragDistance,
    );
    setDrag(null);
    onAimPower(null);
    if (!shot || !hasShotAuthority(drag.authority, snapshot)) return;
    onShoot({
      type: "SHOT",
      matchId: drag.authority.matchId,
      roundId: drag.authority.roundId,
      turnId: drag.authority.turnId,
      shotId: crypto.randomUUID(),
      direction: shot.direction,
      power01: shot.power01,
      hitPointLocal: drag.hitPointLocal,
    });
  }

  function cancel(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    onAimPower(null);
  }

  const preview = drag && hasShotAuthority(drag.authority, snapshot)
    ? calculateShot(drag.start, drag.current, AIM.maxDragDistance)
    : null;

  return (
    <group>
      <group
        ref={group}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        onPointerCancel={cancel}
      >
        <SharpenerModel cosmeticId={cosmetic} active={active} />
      </group>
      {preview && (
        <Line
          points={[
            [body.position.x, 0.018, body.position.z],
            [
              body.position.x +
                preview.direction.x * (0.22 + preview.drag01 * 0.33),
              0.018,
              body.position.z +
                preview.direction.z * (0.22 + preview.drag01 * 0.33),
            ],
          ]}
          color="#fff1b9"
          lineWidth={2.2}
          dashed
          dashScale={15}
        />
      )}
    </group>
  );
}

function DeskScene({
  snapshot,
  cosmetics,
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
      <ClassroomEnvironment snapshot={snapshot} profile={profile} />
      {snapshot.sharpeners.map((body) => (
        <SharpenerFighter
          key={`${body.player}-${snapshot.roundId}-${interactionEpoch}`}
          body={body}
          active={
            snapshot.phase === "AIMING" && snapshot.activePlayer === body.player
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

function fighterName(player: 0 | 1) {
  return player === 0 ? "Orange" : "Blue";
}

export default function MatchCanvas({
  cosmetics,
  onChangeSharpener,
}: {
  cosmetics: MatchCosmetics;
  onChangeSharpener: () => void;
}) {
  const { snapshot, events, error, shoot, reset } = useGameWorker();
  useGameAudio(events, snapshot);
  const [aimPower, setAimPower] = useState<AimPowerState | null>(null);
  const [interactionEpoch, setInteractionEpoch] = useState(0);
  const [webglAvailable] = useState(supportsWebGL);
  const [quality, setQuality] = useState<RenderQuality>(() =>
    initialRenderQuality({
      coarsePointer:
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches,
      viewportWidth: typeof window === "undefined" ? 1440 : window.innerWidth,
    }),
  );
  const [effectsAvailable, setEffectsAvailable] = useState(false);
  const profile = RENDER_PROFILES[quality];
  const displayedAimPower = snapshot
    ? visibleAimPower(aimPower, snapshot.turnId)
    : 0;
  const declineQuality = useCallback(() => {
    setQuality((current) => degradeRenderQuality(current));
  }, []);
  const useLowestQuality = useCallback(() => {
    setQuality("low");
  }, []);
  const disableEffects = useCallback(() => {
    setEffectsAvailable(false);
    setQuality((current) => (current === "high" ? "balanced" : current));
  }, []);
  const resetMatch = useCallback(() => {
    gameAudio.resetVictory();
    setAimPower(null);
    setInteractionEpoch((current) => current + 1);
    reset();
  }, [reset]);
  const seconds = snapshot
    ? Math.ceil(snapshot.aimingTicksRemaining / TICKS_PER_SECOND)
    : PHYSICS.aimingSeconds;
  const roundMessage = snapshot
    ? snapshot.roundWinner === null
      ? "Round draw"
      : `${fighterName(snapshot.roundWinner)} wins the round`
    : "";
  const matchSummary = snapshot ? createMatchSummary(snapshot) : null;

  return (
    <main className={styles["game-shell"]}>
      <section
        className={styles["game-stage"]}
        aria-label="Sharpener Fights classroom arena"
        data-phase={snapshot?.phase ?? "LOADING"}
        data-quality={quality}
      >
        <StaticClassroom snapshot={snapshot} cosmetics={cosmetics} />
        {webglAvailable && (
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
              const supported = canEnableN8ao({
                isWebGL2: gl.capabilities.isWebGL2,
                hasColorBufferFloat: Boolean(
                  context.getExtension("EXT_color_buffer_float"),
                ),
              });
              setEffectsAvailable(supported);
              if (!supported) {
                setQuality((current) =>
                  current === "high" ? "balanced" : current,
                );
              }
            }}
          >
            {snapshot && (
              <DeskScene
                snapshot={snapshot}
                cosmetics={cosmetics}
                onShoot={shoot}
                onAimPower={setAimPower}
                quality={quality}
                effectsAvailable={effectsAvailable}
                interactionEpoch={interactionEpoch}
                onQualityDecline={declineQuality}
                onQualityFallback={useLowestQuality}
                onEffectsUnavailable={disableEffects}
              />
            )}
          </Canvas>
        )}

        {!webglAvailable && (
          <div className={styles["webgl-unavailable"]} role="status" aria-label="3D unavailable">
            <strong>Classroom preview</strong>
            <span>Enable WebGL or browser hardware acceleration, then reload to play.</span>
          </div>
        )}

        {!snapshot && <div className={styles["loading-card"]}>Opening the classroom…</div>}
        {snapshot && (
          <>
            <p className="sr-only" aria-live="polite">
              Round {snapshot.roundId}. Orange {snapshot.scores[0]}, Blue{" "}
              {snapshot.scores[1]}.
            </p>
            <div className={styles["turn-ticket"]} aria-live="polite">
              <span>{snapshot.phase === "AIMING" ? "Your turn" : snapshot.phase.toLowerCase()}</span>
              <strong>
                {snapshot.phase === "AIMING"
                  ? `${fighterName(snapshot.activePlayer)} · ${seconds}`
                  : "Wait for the desk"}
              </strong>
            </div>
            <div
              className={styles["power-rail"]}
              data-part="power-meter"
              aria-label={`Shot power ${Math.round(displayedAimPower * 100)}%`}
            >
              <span>Power</span>
              <div><i style={{ height: `${displayedAimPower * 100}%` }} /></div>
            </div>
            <div className={styles["match-controls"]}>
              <div>
                <button type="button" onClick={onChangeSharpener}>
                  Change sharpener
                </button>
              </div>
              <div>
                {snapshot.phase !== "MATCH_OVER" && (
                  <button type="button" onClick={resetMatch}>Reset</button>
                )}
              </div>
            </div>
          </>
        )}

        {snapshot?.phase === "ROUND_OVER" && (
          <div className={styles["result-card"]} role="status">
            <span>Round {snapshot.roundId}</span>
            <strong>{roundMessage}</strong>
          </div>
        )}
        {matchSummary && (
          <div
            className={styles["winner-overlay"]}
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-title"
            data-part="winner-popup"
            data-winner={matchSummary.winnerName.toLowerCase()}
          >
            <div className={styles["winner-card"]}>
              <span className={styles["winner-kicker"]}>Match report · Best of five</span>
              <div className={styles["winner-stamp"]} aria-hidden="true">Winner</div>
              <h2 id="winner-title">{matchSummary.winnerName} wins!</h2>
              <p>The desk belongs to {matchSummary.winnerName}.</p>
              <dl className={styles["winner-stats"]}>
                <div>
                  <dt>Final score</dt>
                  <dd>{matchSummary.finalScore}</dd>
                </div>
                <div>
                  <dt>Rounds</dt>
                  <dd>{matchSummary.roundsPlayed}</dd>
                </div>
                <div>
                  <dt>Turns</dt>
                  <dd>{matchSummary.totalTurns}</dd>
                </div>
              </dl>
              <button type="button" onClick={resetMatch}>Play again</button>
            </div>
          </div>
        )}
        {error && <div className={styles["error-banner"]}>{error}</div>}
      </section>
    </main>
  );
}
