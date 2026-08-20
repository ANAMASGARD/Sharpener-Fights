"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import { ExtrudeGeometry, Path, Shape } from "three";
import type { SharpenerCosmeticId } from "@sharpener/protocol";
import { getCosmetic } from "./cosmetics";

export function SharpenerModel({
  cosmeticId,
  active = false,
}: {
  cosmeticId: SharpenerCosmeticId;
  active?: boolean;
}) {
  const cosmetic = getCosmetic(cosmeticId);
  const bodyGeometry = useMemo(() => {
    const body = new Shape();
    body.moveTo(-0.025, -0.011);
    body.lineTo(0.025, -0.011);
    body.lineTo(0.0215, 0.011);
    body.quadraticCurveTo(0.021, 0.012, 0.019, 0.012);
    body.lineTo(-0.019, 0.012);
    body.quadraticCurveTo(-0.021, 0.012, -0.0215, 0.011);
    body.closePath();

    const inlet = new Path();
    inlet.absellipse(0, 0, 0.0065, 0.0065, 0, Math.PI * 2, false, 0);
    body.holes.push(inlet);

    const geometry = new ExtrudeGeometry(body, {
      depth: 0.036,
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: 0.00155,
      bevelThickness: 0.00145,
      curveSegments: 32,
      steps: 1,
    });
    geometry.translate(0, 0, -0.018);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  return (
    <group>
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={cosmetic.body}
          roughness={cosmeticId === "aluminium-silver" ? 0.3 : 0.42}
          metalness={cosmeticId === "aluminium-silver" ? 0.72 : 0.08}
          clearcoat={cosmeticId === "aluminium-silver" ? 0.1 : 0.45}
          clearcoatRoughness={0.35}
          emissive={active ? cosmetic.edge : "#000000"}
          emissiveIntensity={active ? 0.22 : 0}
        />
      </mesh>

      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.0005]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.0058, 0.0058, 0.034, 24]} />
        <meshStandardMaterial color="#101414" roughness={0.62} />
      </mesh>

      <RoundedBox
        args={[0.014, 0.00145, 0.029]}
        radius={0.00065}
        smoothness={3}
        position={[0.003, 0.0131, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#c9cecb"
          metalness={0.94}
          roughness={0.16}
          clearcoat={0.18}
          clearcoatRoughness={0.22}
        />
      </RoundedBox>
      <mesh position={[0.003, 0.01405, -0.004]} castShadow receiveShadow>
        <cylinderGeometry args={[0.0038, 0.0038, 0.00055, 28]} />
        <meshStandardMaterial color="#a4aaa8" metalness={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[0.003, 0.01465, -0.004]} castShadow receiveShadow>
        <cylinderGeometry args={[0.003, 0.003, 0.0011, 28]} />
        <meshStandardMaterial color="#777e7c" metalness={0.96} roughness={0.17} />
      </mesh>
      <mesh
        position={[0.003, 0.0153, -0.004]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
      >
        <boxGeometry args={[0.0042, 0.0005, 0.0007]} />
        <meshStandardMaterial color="#343a3b" metalness={0.75} roughness={0.34} />
      </mesh>

      <RoundedBox
        args={[0.046, 0.001, 0.031]}
        radius={0.00045}
        smoothness={2}
        position={[0, -0.0105, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={cosmetic.edge} roughness={0.65} />
      </RoundedBox>
    </group>
  );
}
