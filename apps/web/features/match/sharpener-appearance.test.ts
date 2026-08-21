import { describe, expect, it } from "vitest";
import { PHYSICS } from "@sharpener/game-core";
import {
  SHARPENER_APPEARANCE,
  getSharpenerMaterialProfile,
} from "./sharpener-appearance";
import { createSharpenerBodyGeometry } from "./sharpener-geometry";

describe("classic sharpener appearance", () => {
  it("closely fills the unchanged collider contact footprint", () => {
    const geometry = createSharpenerBodyGeometry();
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    expect(bounds).not.toBeNull();
    if (!bounds) return;

    const visible = {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    };
    const collider = {
      x: PHYSICS.sharpenerHalfExtents.x * 2,
      y: PHYSICS.sharpenerHalfExtents.y * 2,
      z: PHYSICS.sharpenerHalfExtents.z * 2,
    };

    expect(visible.x).toBeLessThanOrEqual(collider.x);
    expect(visible.y).toBeLessThanOrEqual(collider.y);
    expect(visible.z).toBeLessThanOrEqual(collider.z);
    expect(visible.x / collider.x).toBeGreaterThanOrEqual(0.9);
    expect(visible.z / collider.z).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps the colored body dominant over the mounted blade", () => {
    const { body, blade, inlet } = SHARPENER_APPEARANCE;

    expect(body.width / body.depth).toBeLessThan(1.5);
    expect(body.height / body.depth).toBeGreaterThan(0.6);
    expect(blade.length / body.width).toBeLessThan(0.62);
    expect(inlet.radius / body.height).toBeGreaterThan(0.29);
  });

  it("changes Aluminium material response without changing geometry", () => {
    const plastic = getSharpenerMaterialProfile("ember-red");
    const aluminium = getSharpenerMaterialProfile("aluminium-silver");

    expect(plastic.metalness).toBeLessThan(0.1);
    expect(plastic.roughness).toBeGreaterThan(0.35);
    expect(aluminium.metalness).toBeGreaterThan(0.55);
    expect(aluminium.roughness).toBeLessThan(plastic.roughness);
    expect(plastic.dimensions).toBe(SHARPENER_APPEARANCE.body);
    expect(aluminium.dimensions).toBe(SHARPENER_APPEARANCE.body);
  });
});
