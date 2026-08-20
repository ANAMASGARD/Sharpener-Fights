"use client";

import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
} from "three";
import type { GameSnapshot } from "@sharpener/protocol";
import { PHYSICS } from "@sharpener/game-core";
import {
  createPlasterSurface,
  createTileSurface,
  createWoodSurface,
  setSurfaceAnisotropy,
  type SurfaceTextureSet,
} from "./classroom-materials";
import type { RenderProfile } from "./render-quality";

function createScoreTexture(
  roundId: number,
  turnId: number,
  scoreZero: number,
  scoreOne: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 420;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable");

  const gradient = context.createLinearGradient(0, 0, 1024, 420);
  gradient.addColorStop(0, "#101b1b");
  gradient.addColorStop(0.5, "#182827");
  gradient.addColorStop(1, "#0d1717");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 420);

  context.globalAlpha = 0.16;
  context.strokeStyle = "#d9e2d1";
  context.lineWidth = 2;
  for (let index = 0; index < 34; index += 1) {
    const y = 20 + ((index * 73) % 380);
    context.beginPath();
    context.moveTo((index * 97) % 280, y);
    context.lineTo(680 + ((index * 43) % 330), y + (index % 3) - 1);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.textAlign = "center";
  context.fillStyle = "#f3edda";
  context.font = "700 62px Georgia, serif";
  context.fillText("SHARPENER FIGHTS", 512, 86);
  context.fillStyle = "#d6c56f";
  context.font = "700 28px Courier New, monospace";
  context.fillText(`ROUND ${roundId}  ·  BEST OF FIVE`, 512, 130);

  context.textAlign = "left";
  context.fillStyle = "#f2e9d5";
  context.font = "700 38px Courier New, monospace";
  context.fillText("ORANGE", 120, 226);
  context.fillText("BLUE", 120, 304);
  context.fillStyle = "#ee9c54";
  context.font = "700 52px Courier New, monospace";
  context.fillText(String(scoreZero), 390, 229);
  context.fillStyle = "#65bfd1";
  context.fillText(String(scoreOne), 390, 307);

  context.strokeStyle = "rgba(242, 233, 213, 0.35)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(500, 175);
  context.lineTo(500, 330);
  context.stroke();
  context.fillStyle = "#f2e9d5";
  context.font = "600 27px Courier New, monospace";
  context.fillText("TURN", 566, 215);
  context.font = "700 52px Courier New, monospace";
  context.fillText(String(turnId), 566, 282);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}

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

function Chalkboard({ snapshot }: { snapshot: GameSnapshot }) {
  const roundId = snapshot.roundId;
  const turnId = snapshot.turnId;
  const scoreZero = snapshot.scores[0];
  const scoreOne = snapshot.scores[1];
  const texture = useMemo(
    () => createScoreTexture(roundId, turnId, scoreZero, scoreOne),
    [roundId, scoreOne, scoreZero, turnId],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={[0, 0.61, -1.11]}>
      <mesh position={[0, 0, -0.012]} castShadow>
        <boxGeometry args={[1.28, 0.56, 0.045]} />
        <meshStandardMaterial color="#3f2a1c" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[1.18, 0.46]} />
        <meshStandardMaterial map={texture} roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.31, 0.04]} castShadow>
        <boxGeometry args={[1.24, 0.035, 0.1]} />
        <meshStandardMaterial color="#553824" roughness={0.75} />
      </mesh>
      <mesh position={[0.34, -0.277, 0.085]} rotation={[0, 0, 0.03]}>
        <boxGeometry args={[0.12, 0.017, 0.018]} />
        <meshStandardMaterial color="#e8dfc8" roughness={0.9} />
      </mesh>
    </group>
  );
}

function SchoolDesk({ anisotropy }: { anisotropy: number }) {
  const wood = useSurfaceTextureSet(createWoodSurface, anisotropy);
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
            <mesh castShadow rotation={[legZ > 0 ? -0.06 : 0.06, 0, legX > 0 ? -0.04 : 0.04]}>
              <boxGeometry args={[0.045, 0.69, 0.045]} />
              <meshStandardMaterial color="#242728" roughness={0.42} metalness={0.78} />
            </mesh>
            <mesh position={[0, -0.35, legZ > 0 ? 0.04 : -0.04]} castShadow>
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
      <mesh position={[0, 0.25, -1.16]} receiveShadow>
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
    >
      <planeGeometry args={[5, 5, 48, 48]} />
      <meshPhysicalMaterial
        color={tile ? "#ffffff" : "#d8d8cd"}
        map={tile?.albedo ?? null}
        roughnessMap={tile?.roughness ?? null}
        bumpMap={tile?.bump ?? null}
        bumpScale={0.0045}
        roughness={0.88}
        clearcoat={0.08}
        clearcoatRoughness={0.58}
      />
    </mesh>
  );
}

export function ClassroomEnvironment({
  snapshot,
  profile,
}: {
  snapshot: GameSnapshot;
  profile: RenderProfile;
}) {
  const maximumAnisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy(),
  );
  const anisotropy = Math.min(profile.anisotropy, maximumAnisotropy);

  return (
    <>
      <color attach="background" args={["#9da58f"]} />
      <fog attach="fog" args={["#9da58f", 3.2, 6]} />
      <hemisphereLight args={["#fff4dc", "#605f59", 1.15]} />
      <directionalLight
        key={profile.shadowMapSize}
        castShadow
        position={[-1.75, 3.1, 1.65]}
        intensity={2.85}
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
      <Chalkboard snapshot={snapshot} />
      <SchoolDesk anisotropy={anisotropy} />
      <TileFloor anisotropy={anisotropy} />
    </>
  );
}
