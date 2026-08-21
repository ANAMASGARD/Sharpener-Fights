"use client";

import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { GameSnapshot } from "@sharpener/protocol";
import { PHYSICS } from "@sharpener/game-core";
import { createScoreTexture } from "./classroom-board-texture";
import {
  createPlasterSurface,
  createTileSurface,
  createWoodSurface,
  setSurfaceAnisotropy,
  type SurfaceTextureSet,
} from "./classroom-materials";
import { ClassroomProps, NO_RAYCAST } from "./classroom-props";
import type { RenderProfile } from "./render-quality";

// These three deterministic surfaces are immutable apart from sampling quality.
// A module-owned cache keeps abandoned React renders from orphaning GPU resources.
const surfaceCache = new Map<
  (anisotropy: number) => SurfaceTextureSet,
  SurfaceTextureSet
>();

function useSurfaceTextureSet(
  createSurface: (anisotropy: number) => SurfaceTextureSet,
  anisotropy: number,
) {
  const surface = useMemo(() => {
    const cached = surfaceCache.get(createSurface);
    if (cached) return cached;
    const created = createSurface(1);
    surfaceCache.set(createSurface, created);
    return created;
  }, [createSurface]);

  useEffect(() => {
    setSurfaceAnisotropy(surface, anisotropy);
  }, [anisotropy, surface]);

  return surface;
}

function Chalkboard({
  snapshot,
  sceneDate,
}: {
  snapshot: GameSnapshot;
  sceneDate: Date;
}) {
  const roundId = snapshot.roundId;
  const turnId = snapshot.turnId;
  const scoreZero = snapshot.scores[0];
  const scoreOne = snapshot.scores[1];
  const texture = useMemo(
    () => createScoreTexture({ roundId, turnId, scoreZero, scoreOne, sceneDate }),
    [roundId, sceneDate, scoreOne, scoreZero, turnId],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={[0, 0.61, -1.11]}>
      <mesh position={[0, 0, -0.012]} castShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[1.28, 0.56, 0.045]} />
        <meshStandardMaterial color="#3f2a1c" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0, 0.016]} raycast={NO_RAYCAST}>
        <planeGeometry args={[1.18, 0.46]} />
        <meshStandardMaterial map={texture} roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.31, 0.04]} castShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[1.24, 0.035, 0.1]} />
        <meshStandardMaterial color="#553824" roughness={0.75} />
      </mesh>
      <mesh
        position={[0.34, -0.277, 0.085]}
        rotation={[0, 0, 0.03]}
        raycast={NO_RAYCAST}
      >
        <boxGeometry args={[0.12, 0.017, 0.018]} />
        <meshStandardMaterial color="#e8dfc8" roughness={0.9} />
      </mesh>
    </group>
  );
}

function SchoolDesk({ wood }: { wood: SurfaceTextureSet }) {
  const { x, y, z } = PHYSICS.tableHalfExtents;

  return (
    <group>
      <RoundedBox
        args={[x * 2 + 0.025, y * 2 + 0.03, z * 2 + 0.025]}
        radius={0.014}
        smoothness={4}
        position={[0, -y - 0.016, 0]}
        castShadow
        receiveShadow
        raycast={NO_RAYCAST}
      >
        <meshStandardMaterial color="#3e1d10" roughness={0.72} />
      </RoundedBox>
      <RoundedBox
        args={[x * 2, y * 2, z * 2]}
        radius={0.011}
        smoothness={4}
        position={[0, -y + 0.001, 0]}
        castShadow
        receiveShadow
        raycast={NO_RAYCAST}
      >
        <meshPhysicalMaterial
          color={wood ? "#ffffff" : "#b76f34"}
          map={wood?.albedo ?? null}
          roughnessMap={wood?.roughness ?? null}
          bumpMap={wood?.bump ?? null}
          bumpScale={0.0011}
          roughness={0.82}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.34}
        />
      </RoundedBox>

      {[-0.34, 0.34].flatMap((legX) =>
        [-0.53, 0.53].map((legZ) => (
          <group key={`${legX}:${legZ}`} position={[legX, -0.39, legZ]}>
            <mesh
              castShadow
              rotation={[legZ > 0 ? -0.06 : 0.06, 0, legX > 0 ? -0.04 : 0.04]}
              raycast={NO_RAYCAST}
            >
              <boxGeometry args={[0.045, 0.69, 0.045]} />
              <meshStandardMaterial color="#242728" roughness={0.42} metalness={0.78} />
            </mesh>
            <mesh
              position={[0, -0.35, legZ > 0 ? 0.04 : -0.04]}
              castShadow
              raycast={NO_RAYCAST}
            >
              <boxGeometry args={[0.085, 0.025, 0.14]} />
              <meshStandardMaterial color="#17191a" roughness={0.58} metalness={0.62} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

function SchoolWall({ anisotropy }: { anisotropy: number }) {
  const plaster = useSurfaceTextureSet(createPlasterSurface, anisotropy);

  return (
    <group>
      <mesh position={[0, 0.25, -1.16]} receiveShadow raycast={NO_RAYCAST}>
        <planeGeometry args={[4.4, 2.6, 32, 18]} />
        <meshStandardMaterial
          color={plaster ? "#ffffff" : "#9da58f"}
          map={plaster?.albedo ?? null}
          roughnessMap={plaster?.roughness ?? null}
          bumpMap={plaster?.bump ?? null}
          bumpScale={0.0022}
          roughness={0.96}
        />
      </mesh>
      <RoundedBox
        args={[4.4, 0.075, 0.045]}
        radius={0.012}
        smoothness={3}
        position={[0, -0.715, -1.115]}
        receiveShadow
        raycast={NO_RAYCAST}
      >
        <meshStandardMaterial color="#747765" roughness={0.78} />
      </RoundedBox>
    </group>
  );
}

function TileFloor({ anisotropy }: { anisotropy: number }) {
  const tile = useSurfaceTextureSet(createTileSurface, anisotropy);

  return (
    <mesh
      position={[0, -0.76, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      raycast={NO_RAYCAST}
    >
      <planeGeometry args={[5, 5, 48, 48]} />
      <meshPhysicalMaterial
        color={tile ? "#ffffff" : "#d8d8cd"}
        map={tile?.albedo ?? null}
        roughnessMap={tile?.roughness ?? null}
        bumpMap={tile?.bump ?? null}
        bumpScale={0.0032}
        roughness={0.62}
        clearcoat={0.22}
        clearcoatRoughness={0.42}
      />
    </mesh>
  );
}

export function ClassroomEnvironment({
  snapshot,
  profile,
  sceneDate,
}: {
  snapshot: GameSnapshot;
  profile: RenderProfile;
  sceneDate: Date;
}) {
  const maximumAnisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy(),
  );
  const anisotropy = Math.min(profile.anisotropy, maximumAnisotropy);
  const wood = useSurfaceTextureSet(createWoodSurface, anisotropy);

  return (
    <>
      <color attach="background" args={["#a4aa92"]} />
      <fog attach="fog" args={["#a4aa92", 3.4, 6.2]} />
      <hemisphereLight args={["#fff0cf", "#59615f", 1.08]} />
      <directionalLight
        key={profile.shadowMapSize}
        castShadow
        position={[-1.75, 3.1, 1.65]}
        intensity={2.72}
        shadow-mapSize-width={profile.shadowMapSize}
        shadow-mapSize-height={profile.shadowMapSize}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.2}
        shadow-bias={-0.00012}
        shadow-normalBias={0.018}
        shadow-radius={5}
      />

      <SchoolWall anisotropy={anisotropy} />
      <Chalkboard snapshot={snapshot} sceneDate={sceneDate} />
      <ClassroomProps
        wood={wood}
        shadowLevel={profile.decorativeShadowLevel}
      />
      <SchoolDesk wood={wood} />
      <TileFloor anisotropy={anisotropy} />
    </>
  );
}
