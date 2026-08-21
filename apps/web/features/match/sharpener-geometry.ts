import { ExtrudeGeometry, Path, Shape } from "three";
import { SHARPENER_APPEARANCE } from "./sharpener-appearance";

export function createSharpenerBodyGeometry(): ExtrudeGeometry {
  const { body, bevel, inlet } = SHARPENER_APPEARANCE;
  const halfWidth = (body.width - bevel.size * 2) / 2;
  const halfHeight = (body.height - bevel.size * 2) / 2;
  const corner = 0.0027;
  const extrusion = body.depth - bevel.size * 2;

  const endProfile = new Shape();
  endProfile.moveTo(-halfWidth + corner, -halfHeight);
  endProfile.lineTo(halfWidth - corner, -halfHeight);
  endProfile.quadraticCurveTo(
    halfWidth,
    -halfHeight,
    halfWidth,
    -halfHeight + corner,
  );
  endProfile.lineTo(halfWidth, halfHeight - corner);
  endProfile.quadraticCurveTo(
    halfWidth,
    halfHeight,
    halfWidth - corner,
    halfHeight,
  );
  endProfile.lineTo(-halfWidth + corner, halfHeight * 0.92);
  endProfile.quadraticCurveTo(
    -halfWidth,
    halfHeight * 0.9,
    -halfWidth,
    halfHeight - corner,
  );
  endProfile.lineTo(-halfWidth, -halfHeight + corner);
  endProfile.quadraticCurveTo(
    -halfWidth,
    -halfHeight,
    -halfWidth + corner,
    -halfHeight,
  );
  endProfile.closePath();

  const pencilInlet = new Path();
  pencilInlet.absellipse(0, 0, inlet.radius, inlet.radius, 0, Math.PI * 2, false);
  endProfile.holes.push(pencilInlet);

  const geometry = new ExtrudeGeometry(endProfile, {
    depth: extrusion,
    bevelEnabled: true,
    bevelSegments: bevel.segments,
    bevelSize: bevel.size,
    bevelThickness: bevel.size,
    curveSegments: 32,
    steps: 1,
  });
  geometry.translate(0, 0, -extrusion / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
