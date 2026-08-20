"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
} from "three";
import type { GameSnapshot } from "@sharpener/protocol";
import { PHYSICS } from "@sharpener/game-core";

function createWoodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable");

  const gradient = context.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, "#8e5229");
  gradient.addColorStop(0.24, "#bf7940");
  gradient.addColorStop(0.56, "#d29450");
  gradient.addColorStop(0.82, "#a96534");
  gradient.addColorStop(1, "#79421f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 1024);

  let seed = 481516;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  context.lineCap = "round";
  for (let index = 0; index < 150; index += 1) {
    const y = random() * 1024;
    context.strokeStyle = `rgba(68, 30, 13, ${0.025 + random() * 0.07})`;
    context.lineWidth = 0.7 + random() * 2.1;
    context.beginPath();
    context.moveTo(-60, y);
    context.bezierCurveTo(
      230,
      y + random() * 28 - 14,
      720,
      y + random() * 28 - 14,
      1080,
      y + random() * 12 - 6,
    );
    context.stroke();
  }

  context.strokeStyle = "rgba(247, 211, 152, 0.25)";
  context.lineWidth = 3;
  const scratches = [
    [180, 230, 325, 420],
    [205, 225, 340, 390],
    [720, 280, 810, 210],
    [640, 730, 820, 790],
    [380, 600, 425, 470],
  ];
  for (const [x1, y1, x2, y2] of scratches) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }
  context.font = "italic 58px Georgia";
  context.fillStyle = "rgba(249, 213, 152, 0.22)";
  context.save();
  context.translate(760, 620);
  context.rotate(-0.15);
  context.fillText("A + R", 0, 0);
  context.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  return texture;
}

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

function SchoolDesk() {
  const woodTexture = useMemo(() => createWoodTexture(), []);
  useEffect(() => () => woodTexture.dispose(), [woodTexture]);
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
        <meshStandardMaterial color="#4d2918" roughness={0.76} />
      </RoundedBox>
      <RoundedBox
        args={[x * 2, y * 2, z * 2]}
        radius={0.011}
        smoothness={4}
        position={[0, -y + 0.001, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial map={woodTexture} roughness={0.63} metalness={0.01} />
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

export function ClassroomEnvironment({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <>
      <color attach="background" args={["#9ba38c"]} />
      <fog attach="fog" args={["#9ba38c", 3.1, 6]} />
      <hemisphereLight args={["#fff4dc", "#6a655e", 1.4]} />
      <directionalLight
        castShadow
        position={[-1.4, 2.8, 1.8]}
        intensity={2.7}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.2}
      />

      <mesh position={[0, 0.25, -1.16]} receiveShadow>
        <planeGeometry args={[4.4, 2.6]} />
        <meshStandardMaterial color="#a9b09b" roughness={0.94} />
      </mesh>
      <Chalkboard snapshot={snapshot} />
      <SchoolDesk />

      <mesh position={[0, -0.76, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#dedbd0" roughness={0.9} />
      </mesh>
      <gridHelper
        args={[5, 22, "#77746d", "#97938a"]}
        position={[0, -0.755, 0]}
      />
    </>
  );
}
