"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Line, PerspectiveCamera } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import { Group, Plane, Quaternion, Vector3 } from "three";
import type { BodySnapshot, GameSnapshot, ShotCommand } from "@sharpener/protocol";
import { calculateShot, centerAssist, type DeskPoint, type LocalHitPoint } from "./aim";
import { ClassroomEnvironment } from "./classroom-environment";
import { SharpenerModel } from "./sharpener-model";
import type { MatchCosmetics } from "./sharpener-selector";
import { useGameWorker } from "./use-game-worker";
import { useGameAudio } from "./use-game-audio";
import { StaticClassroom } from "./static-classroom";
import { supportsWebGL } from "./webgl-support";

type DragState = {
  pointerId: number;
  start: DeskPoint;
  current: DeskPoint;
  hitPointLocal: LocalHitPoint;
};

function ResponsiveCamera() {
  const size = useThree((state) => state.size);
  const portrait = size.width / size.height < 0.82;
  return (
    <PerspectiveCamera
      makeDefault
      position={[0, portrait ? 3.1 : 2.35, portrait ? 3 : 2.4]}
      fov={portrait ? 38 : 42}
      near={0.01}
      far={12}
      onUpdate={(camera) => camera.lookAt(0, -0.08, -0.14)}
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
  onAimPower: (power: number) => void;
}) {
  const group = useRef<Group>(null);
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
        { x: local.x, y: local.y, z: local.z },
        0.008,
      ),
    });
    onAimPower(0);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    const point = planePoint(event);
    if (!point) return;
    const current = { x: point.x, z: point.z };
    setDrag((value) => (value ? { ...value, current } : value));
    onAimPower(calculateShot(drag.start, current, 0.28)?.drag01 ?? 0);
  }

  function release(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    const shot = calculateShot(drag.start, drag.current, 0.28);
    setDrag(null);
    onAimPower(0);
    if (!shot || snapshot.phase !== "AIMING") return;
    onShoot({
      type: "SHOT",
      matchId: snapshot.matchId,
      roundId: snapshot.roundId,
      turnId: snapshot.turnId,
      shotId: crypto.randomUUID(),
      direction: shot.direction,
      power01: shot.power01,
      hitPointLocal: drag.hitPointLocal,
    });
  }

  function cancel(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    onAimPower(0);
  }

  const preview = drag ? calculateShot(drag.start, drag.current, 0.28) : null;

  return (
    <group>
      <group
        ref={group}
        position={[body.position.x, body.position.y, body.position.z]}
        quaternion={[
          body.rotation.x,
          body.rotation.y,
          body.rotation.z,
          body.rotation.w,
        ]}
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
}: {
  snapshot: GameSnapshot;
  cosmetics: MatchCosmetics;
  onShoot: (command: ShotCommand) => void;
  onAimPower: (power: number) => void;
}) {
  return (
    <>
      <ResponsiveCamera />
      <ClassroomEnvironment snapshot={snapshot} />
      {snapshot.sharpeners.map((body) => (
        <SharpenerFighter
          key={`${body.player}-${snapshot.roundId}`}
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
  const { preferences, toggleSfx, toggleAmbience } = useGameAudio(
    events,
    snapshot,
  );
  const [aimPower, setAimPower] = useState(0);
  const [webglAvailable] = useState(supportsWebGL);
  const seconds = snapshot ? Math.ceil(snapshot.aimingTicksRemaining / 120) : 15;
  const roundMessage = snapshot
    ? snapshot.roundWinner === null
      ? "Round draw"
      : `${fighterName(snapshot.roundWinner)} wins the round`
    : "";
  const matchMessage = snapshot?.matchWinner === 0
    ? "Orange wins the match"
    : "Blue wins the match";

  return (
    <main className="game-shell">
      <section
        className="game-stage"
        aria-label="Sharpener Fights classroom arena"
        data-phase={snapshot?.phase ?? "LOADING"}
      >
        <StaticClassroom snapshot={snapshot} cosmetics={cosmetics} />
        {webglAvailable && (
          <Canvas
            className="arena-canvas"
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [0, 2.35, 2.4], fov: 42, near: 0.01, far: 12 }}
            gl={{ antialias: true, powerPreference: "default" }}
          >
            {snapshot && (
              <DeskScene
                snapshot={snapshot}
                cosmetics={cosmetics}
                onShoot={shoot}
                onAimPower={setAimPower}
              />
            )}
          </Canvas>
        )}

        {!webglAvailable && (
          <div className="webgl-unavailable" role="status" aria-label="3D unavailable">
            <strong>Classroom preview</strong>
            <span>Enable WebGL or browser hardware acceleration, then reload to play.</span>
          </div>
        )}

        {!snapshot && <div className="loading-card">Opening the classroom…</div>}
        {snapshot && (
          <>
            <p className="sr-only" aria-live="polite">
              Round {snapshot.roundId}. Orange {snapshot.scores[0]}, Blue{" "}
              {snapshot.scores[1]}.
            </p>
            <div className="turn-ticket" aria-live="polite">
              <span>{snapshot.phase === "AIMING" ? "Your turn" : snapshot.phase.toLowerCase()}</span>
              <strong>
                {snapshot.phase === "AIMING"
                  ? `${fighterName(snapshot.activePlayer)} · ${seconds}`
                  : "Wait for the desk"}
              </strong>
            </div>
            <div className="power-rail" aria-label={`Shot power ${Math.round(aimPower * 100)}%`}>
              <span>Power</span>
              <div><i style={{ height: `${aimPower * 100}%` }} /></div>
            </div>
            <div className="match-controls">
              <div>
                <button type="button" onClick={onChangeSharpener}>
                  Change sharpener
                </button>
              </div>
              <div className="audio-controls">
                <button
                  type="button"
                  onClick={toggleSfx}
                  aria-pressed={preferences.sfxMuted}
                >
                  SFX {preferences.sfxMuted ? "off" : "on"}
                </button>
                <button
                  type="button"
                  onClick={toggleAmbience}
                  aria-pressed={preferences.ambienceMuted}
                >
                  Room {preferences.ambienceMuted ? "off" : "on"}
                </button>
                <button type="button" onClick={reset}>
                  {snapshot.phase === "MATCH_OVER" ? "Rematch" : "Reset"}
                </button>
              </div>
            </div>
          </>
        )}

        {snapshot?.phase === "ROUND_OVER" && (
          <div className="result-card" role="status">
            <span>Round {snapshot.roundId}</span>
            <strong>{roundMessage}</strong>
          </div>
        )}
        {snapshot?.phase === "MATCH_OVER" && (
          <div className="result-card" role="status">
            <span>Best of five</span>
            <strong>{matchMessage}</strong>
            <small>Final score {snapshot.scores[0]}–{snapshot.scores[1]}</small>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
      </section>
    </main>
  );
}
