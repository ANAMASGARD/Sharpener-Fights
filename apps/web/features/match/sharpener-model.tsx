"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { BackSide } from "three";
import type { SharpenerCosmeticId } from "@sharpener/protocol";
import { getCosmetic } from "./cosmetics";
import {
  SHARPENER_APPEARANCE,
  getSharpenerMaterialProfile,
} from "./sharpener-appearance";
import { createSharpenerBodyGeometry } from "./sharpener-geometry";

export function SharpenerModel({
  cosmeticId,
  active = false,
}: {
  cosmeticId: SharpenerCosmeticId;
  active?: boolean;
}) {
  const cosmetic = getCosmetic(cosmeticId);
  const material = getSharpenerMaterialProfile(cosmeticId);
  const bodyGeometry = useMemo(() => createSharpenerBodyGeometry(), []);
  const { body, inlet, blade, screw } = SHARPENER_APPEARANCE;
  const bodyTop = body.height / 2;
  const frontFace = body.depth / 2 + 0.00012;

  useEffect(() => () => bodyGeometry.dispose(), [bodyGeometry]);

  return (
    <group name="classic-school-sharpener">
      <mesh
        name="sharpener-body"
        geometry={bodyGeometry}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color={cosmetic.body}
          roughness={material.roughness}
          metalness={material.metalness}
          clearcoat={material.clearcoat}
          clearcoatRoughness={material.clearcoatRoughness}
          emissive={active ? cosmetic.edge : "#000000"}
          emissiveIntensity={active ? 0.16 : 0}
        />
      </mesh>

      <mesh
        name="pencil-inlet-tunnel"
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        castShadow
      >
        <cylinderGeometry
          args={[
            inlet.radius * 0.96,
            inlet.radius * 0.96,
            inlet.tunnelLength,
            32,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color="#070909"
          roughness={0.82}
          metalness={0.02}
          side={BackSide}
        />
      </mesh>

      <mesh
        name="pencil-inlet-bezel"
        position={[0, 0, frontFace]}
        castShadow
        receiveShadow
      >
        <torusGeometry
          args={[
            (inlet.radius + inlet.bezelRadius) / 2,
            (inlet.bezelRadius - inlet.radius) / 2,
            12,
            32,
          ]}
        />
        <meshStandardMaterial
          color={cosmetic.edge}
          roughness={0.5}
          metalness={material.metalness * 0.55}
        />
      </mesh>

      <RoundedBox
        name="blade-channel"
        args={[blade.width + 0.0024, 0.00062, blade.channelLength]}
        radius={0.00055}
        smoothness={3}
        position={[0.002, bodyTop + 0.00005, -0.0008]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#252a29" roughness={0.68} metalness={0.16} />
      </RoundedBox>

      <RoundedBox
        name="blade-plate"
        args={[blade.width, blade.height, blade.length]}
        radius={0.00058}
        smoothness={3}
        position={[0.002, bodyTop + blade.height * 0.64, -0.0008]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#c7cdcb"
          metalness={0.92}
          roughness={0.2}
          clearcoat={0.12}
          clearcoatRoughness={0.25}
        />
      </RoundedBox>

      <mesh
        name="blade-screw"
        position={[
          0.002,
          bodyTop + blade.height + screw.height * 0.55,
          -0.004,
        ]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[screw.radius, screw.radius, screw.height, 28]}
        />
        <meshStandardMaterial
          color="#969d9a"
          metalness={0.88}
          roughness={0.27}
        />
      </mesh>

      <mesh
        name="blade-screw-slot"
        position={[
          0.002,
          bodyTop + blade.height + screw.height + 0.00008,
          -0.004,
        ]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
      >
        <boxGeometry args={[screw.radius * 1.35, 0.00022, 0.00055]} />
        <meshStandardMaterial
          color="#303635"
          metalness={0.72}
          roughness={0.38}
        />
      </mesh>

      <RoundedBox
        name="molded-underside"
        args={[body.width * 0.91, 0.0008, body.depth * 0.86]}
        radius={0.00045}
        smoothness={2}
        position={[0, -body.height / 2 + 0.00045, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={cosmetic.edge} roughness={0.65} />
      </RoundedBox>
    </group>
  );
}
