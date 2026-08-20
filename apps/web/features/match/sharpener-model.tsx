"use client";

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
      bevelSegments: 3,
      bevelSize: 0.0013,
      bevelThickness: 0.0013,
      curveSegments: 24,
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

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.0005]}>
        <cylinderGeometry args={[0.0058, 0.0058, 0.034, 24]} />
        <meshStandardMaterial color="#121719" roughness={0.7} />
      </mesh>

      <mesh position={[0.003, 0.0131, 0]} castShadow>
        <boxGeometry args={[0.014, 0.0014, 0.029]} />
        <meshStandardMaterial color="#b9bdba" metalness={0.92} roughness={0.18} />
      </mesh>
      <mesh position={[0.003, 0.0142, -0.004]} castShadow>
        <cylinderGeometry args={[0.003, 0.003, 0.0017, 20]} />
        <meshStandardMaterial color="#747b7b" metalness={0.95} roughness={0.2} />
      </mesh>
      <mesh position={[0.003, 0.01515, -0.004]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.0042, 0.0005, 0.0007]} />
        <meshStandardMaterial color="#343a3b" metalness={0.75} roughness={0.34} />
      </mesh>

      <mesh position={[0, -0.0105, 0]}>
        <boxGeometry args={[0.046, 0.001, 0.031]} />
        <meshStandardMaterial color={cosmetic.edge} roughness={0.65} />
      </mesh>
    </group>
  );
}
