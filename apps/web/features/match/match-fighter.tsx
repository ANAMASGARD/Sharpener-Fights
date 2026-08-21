"use client";

import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { Group, Plane, Quaternion, Vector3 } from "three";
import { PHYSICS } from "@sharpener/game-core";
import type { BodySnapshot, GameSnapshot, ShotCommand } from "@sharpener/protocol";
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
  type AimPowerState,
  type ShotAuthority,
} from "./aim-session";
import type { MatchCosmetics } from "./sharpener-selector";
import { SharpenerModel } from "./sharpener-model";

type DragState = {
  pointerId: number;
  start: DeskPoint;
  current: DeskPoint;
  hitPointLocal: LocalHitPoint;
  authority: ShotAuthority;
};

export function MatchFighter({
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
        calculateShot(drag.start, current, AIM.maxDragDistance)?.power01 ?? 0,
    });
  }

  function release(event: ThreeEvent<PointerEvent>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    const shot = calculateShot(drag.start, drag.current, AIM.maxDragDistance);
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

  const preview =
    drag && hasShotAuthority(drag.authority, snapshot)
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
