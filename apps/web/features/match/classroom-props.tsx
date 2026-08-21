"use client";

import {
  Instance,
  Instances,
} from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { RoundedBoxGeometry } from "three-stdlib";
import type { Mesh } from "three";
import type { SurfaceTextureSet } from "./classroom-materials";
import type { RenderProfile } from "./render-quality";

export const NO_RAYCAST: Mesh["raycast"] = () => {};

type FurniturePlacement = {
  x: number;
  z: number;
  rotation: number;
  seatOffset: number;
};

const FURNITURE: readonly FurniturePlacement[] = [
  { x: -1.02, z: -0.58, rotation: 0.035, seatOffset: 0.29 },
  { x: 1.02, z: -0.58, rotation: -0.035, seatOffset: 0.29 },
  { x: -1.03, z: 0.63, rotation: -0.055, seatOffset: -0.29 },
  { x: 1.03, z: 0.63, rotation: 0.055, seatOffset: -0.29 },
];

function offset(
  placement: FurniturePlacement,
  localX: number,
  localZ: number,
  y: number,
): [number, number, number] {
  const cosine = Math.cos(placement.rotation);
  const sine = Math.sin(placement.rotation);
  return [
    placement.x + localX * cosine + localZ * sine,
    y,
    placement.z - localX * sine + localZ * cosine,
  ];
}

function ClassroomFurniture({
  wood,
  castShadow,
}: {
  wood: SurfaceTextureSet;
  castShadow: boolean;
}) {
  return (
    <>
      <Instances limit={8} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#572d17" roughness={0.72} />
        {FURNITURE.flatMap((placement, index) => [
          <Instance
            key={`desk-edge-${index}`}
            position={offset(placement, 0, 0, -0.132)}
            rotation={[0, placement.rotation, 0]}
            scale={[0.67, 0.075, 0.3]}
          />,
          <Instance
            key={`seat-edge-${index}`}
            position={offset(placement, 0, placement.seatOffset, -0.345)}
            rotation={[0, placement.rotation, 0]}
            scale={[0.63, 0.065, 0.19]}
          />,
        ])}
      </Instances>

      <Instances limit={8} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#ffffff"
          map={wood.albedo}
          roughnessMap={wood.roughness}
          bumpMap={wood.bump}
          bumpScale={0.0008}
          roughness={0.68}
          clearcoat={0.2}
          clearcoatRoughness={0.42}
        />
        {FURNITURE.flatMap((placement, index) => [
          <Instance
            key={`desk-top-${index}`}
            position={offset(placement, 0, 0, -0.102)}
            rotation={[0, placement.rotation, 0]}
            scale={[0.64, 0.04, 0.28]}
          />,
          <Instance
            key={`seat-top-${index}`}
            position={offset(placement, 0, placement.seatOffset, -0.318)}
            rotation={[0, placement.rotation, 0]}
            scale={[0.6, 0.04, 0.17]}
          />,
        ])}
      </Instances>

      <Instances limit={32} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#282b2a" roughness={0.44} metalness={0.7} />
        {FURNITURE.flatMap((placement, index) => {
          const deskLegs = [-0.26, 0.26].flatMap((x) =>
            [-0.095, 0.095].map((z, legIndex) => (
              <Instance
                key={`desk-leg-${index}-${legIndex}-${x}`}
                position={offset(placement, x, z, -0.445)}
                rotation={[0, placement.rotation, x > 0 ? -0.035 : 0.035]}
                scale={[0.032, 0.61, 0.032]}
              />
            )),
          );
          const seatLegs = [-0.24, 0.24].map((x) => (
            <Instance
              key={`seat-leg-${index}-${x}`}
              position={offset(placement, x, placement.seatOffset, -0.535)}
              rotation={[0, placement.rotation, x > 0 ? -0.025 : 0.025]}
              scale={[0.03, 0.39, 0.03]}
            />
          ));
          const crossbar = (
            <Instance
              key={`crossbar-${index}`}
              position={offset(placement, 0, 0, -0.56)}
              rotation={[0, placement.rotation, 0]}
              scale={[0.54, 0.025, 0.025]}
            />
          );
          return [...deskLegs, ...seatLegs, crossbar];
        })}
      </Instances>
    </>
  );
}

const BOTTLES = [
  { position: [-1.13, 0.005, -0.6] as const, color: "#aeb4ab" },
  { position: [0.91, 0.005, -0.61] as const, color: "#397e87" },
  { position: [-0.91, 0.005, 0.62] as const, color: "#a35668" },
];

const LUNCH_BOXES = [
  { position: [-0.91, -0.055, -0.57] as const, color: "#425a7b" },
  { position: [1.12, -0.055, -0.57] as const, color: "#71814c" },
  { position: [-1.15, -0.055, 0.63] as const, color: "#a96f73" },
];

function DeskAccessories({ castShadow }: { castShadow: boolean }) {
  return (
    <>
      <Instances limit={3} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <cylinderGeometry args={[0.034, 0.029, 0.19, 12]} />
        <meshPhysicalMaterial roughness={0.25} clearcoat={0.48} clearcoatRoughness={0.28} />
        {BOTTLES.map((bottle, index) => (
          <Instance key={`bottle-${index}`} position={bottle.position} color={bottle.color} />
        ))}
      </Instances>
      <Instances limit={3} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial roughness={0.42} clearcoat={0.2} clearcoatRoughness={0.5} />
        {LUNCH_BOXES.map((lunchbox, index) => (
          <Instance
            key={`lunchbox-${index}`}
            position={lunchbox.position}
            scale={[0.17, 0.085, 0.12]}
            color={lunchbox.color}
          />
        ))}
      </Instances>
    </>
  );
}

const BAGS = [
  { position: [0.73, -0.59, -0.78] as const, rotation: -0.16, color: "#243856" },
  { position: [1.28, -0.59, 0.54] as const, rotation: 0.22, color: "#693b3c" },
] as const;

function SchoolBags({ castShadow }: { castShadow: boolean }) {
  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(0.27, 0.32, 0.15, 3, 0.045),
    [],
  );
  const pocketGeometry = useMemo(
    () => new RoundedBoxGeometry(0.21, 0.13, 0.035, 3, 0.025),
    [],
  );
  useEffect(
    () => () => {
      bodyGeometry.dispose();
      pocketGeometry.dispose();
    },
    [bodyGeometry, pocketGeometry],
  );
  return (
    <>
      <Instances limit={2} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <primitive attach="geometry" object={bodyGeometry} />
        <meshStandardMaterial roughness={0.88} />
        {BAGS.map((bag, index) => (
          <Instance
            key={`bag-${index}`}
            position={bag.position}
            rotation={[0, bag.rotation, 0]}
            color={bag.color}
          />
        ))}
      </Instances>
      <Instances limit={2} castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <primitive attach="geometry" object={pocketGeometry} />
        <meshStandardMaterial roughness={0.92} />
        {BAGS.map((bag, index) => (
          <Instance
            key={`bag-pocket-${index}`}
            position={[bag.position[0], bag.position[1] - 0.055, bag.position[2] + 0.088]}
            rotation={[0, bag.rotation, 0]}
            color={bag.color}
          />
        ))}
      </Instances>
    </>
  );
}

function Dustbin({ castShadow }: { castShadow: boolean }) {
  return (
    <group position={[-1.42, -0.55, -0.18]} rotation={[0, 0, -0.02]}>
      <mesh castShadow={castShadow} receiveShadow raycast={NO_RAYCAST}>
        <cylinderGeometry args={[0.12, 0.1, 0.4, 16]} />
        <meshStandardMaterial color="#455b43" roughness={0.7} metalness={0.42} />
      </mesh>
    </group>
  );
}

export function ClassroomProps({
  wood,
  shadowLevel,
}: {
  wood: SurfaceTextureSet;
  shadowLevel: RenderProfile["decorativeShadowLevel"];
}) {
  const majorShadows = shadowLevel !== "none";
  const fullShadows = shadowLevel === "full";
  return (
    <group name="classroom-decoration">
      <ClassroomFurniture wood={wood} castShadow={majorShadows} />
      <DeskAccessories castShadow={fullShadows} />
      <SchoolBags castShadow={majorShadows} />
      <Dustbin castShadow={majorShadows} />
    </group>
  );
}
