import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  SRGBColorSpace,
} from "three";

export type SurfaceTextureSet = {
  albedo: CanvasTexture;
  roughness: CanvasTexture;
  bump: CanvasTexture;
  dispose(): void;
};

export function setSurfaceAnisotropy(
  surface: SurfaceTextureSet,
  anisotropy: number,
) {
  for (const texture of [surface.albedo, surface.roughness, surface.bump]) {
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  }
}

type TextureKind = "albedo" | "scalar";

function seededRandom(initialSeed: number) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function createCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable");
  return { canvas, context };
}

function makeTexture(
  canvas: HTMLCanvasElement,
  kind: TextureKind,
  anisotropy: number,
) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = kind === "albedo" ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function textureSet(
  albedoCanvas: HTMLCanvasElement,
  roughnessCanvas: HTMLCanvasElement,
  bumpCanvas: HTMLCanvasElement,
  anisotropy: number,
): SurfaceTextureSet {
  const albedo = makeTexture(albedoCanvas, "albedo", anisotropy);
  const roughness = makeTexture(roughnessCanvas, "scalar", anisotropy);
  const bump = makeTexture(bumpCanvas, "scalar", anisotropy);
  return {
    albedo,
    roughness,
    bump,
    dispose() {
      albedo.dispose();
      roughness.dispose();
      bump.dispose();
    },
  };
}

function addFineNoise(
  context: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  dark: string,
  light: string,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    context.fillStyle = random() > 0.48 ? dark : light;
    const radius = 0.35 + random() * 1.2;
    context.fillRect(random() * size, random() * size, radius, radius);
  }
}

export function createWoodSurface(anisotropy: number): SurfaceTextureSet {
  const size = 1024;
  const random = seededRandom(0x53464f4f);
  const albedo = createCanvas(size);
  const roughness = createCanvas(size);
  const bump = createCanvas(size);

  const base = albedo.context.createLinearGradient(0, 0, size, 0);
  base.addColorStop(0, "#7e421d");
  base.addColorStop(0.16, "#b7652b");
  base.addColorStop(0.48, "#d28a42");
  base.addColorStop(0.72, "#bd6f31");
  base.addColorStop(1, "#713718");
  albedo.context.fillStyle = base;
  albedo.context.fillRect(0, 0, size, size);

  roughness.context.fillStyle = "#999999";
  roughness.context.fillRect(0, 0, size, size);
  bump.context.fillStyle = "#808080";
  bump.context.fillRect(0, 0, size, size);

  for (let index = 0; index < 310; index += 1) {
    const y = random() * size;
    const sway = random() * 30 - 15;
    const alpha = 0.025 + random() * 0.075;
    const width = 0.5 + random() * 2.2;

    albedo.context.strokeStyle = `rgba(55, 22, 8, ${alpha})`;
    albedo.context.lineWidth = width;
    albedo.context.beginPath();
    albedo.context.moveTo(-40, y);
    albedo.context.bezierCurveTo(240, y + sway, 730, y - sway, size + 40, y + sway * 0.3);
    albedo.context.stroke();

    roughness.context.strokeStyle = random() > 0.5 ? "#8b8b8b" : "#aaaaaa";
    roughness.context.lineWidth = width * 1.4;
    roughness.context.beginPath();
    roughness.context.moveTo(-40, y);
    roughness.context.bezierCurveTo(240, y + sway, 730, y - sway, size + 40, y + sway * 0.3);
    roughness.context.stroke();

    bump.context.strokeStyle = random() > 0.5 ? "#777777" : "#898989";
    bump.context.lineWidth = width;
    bump.context.beginPath();
    bump.context.moveTo(-40, y);
    bump.context.bezierCurveTo(240, y + sway, 730, y - sway, size + 40, y + sway * 0.3);
    bump.context.stroke();
  }

  const scratches = [
    [170, 250, 300, 405],
    [195, 242, 325, 385],
    [716, 276, 806, 216],
    [638, 728, 828, 784],
    [385, 602, 429, 472],
  ] as const;
  albedo.context.lineCap = "round";
  bump.context.lineCap = "round";
  for (const [x1, y1, x2, y2] of scratches) {
    albedo.context.strokeStyle = "rgba(255, 218, 157, 0.24)";
    albedo.context.lineWidth = 2;
    albedo.context.beginPath();
    albedo.context.moveTo(x1, y1);
    albedo.context.lineTo(x2, y2);
    albedo.context.stroke();
    bump.context.strokeStyle = "#686868";
    bump.context.lineWidth = 1.5;
    bump.context.beginPath();
    bump.context.moveTo(x1, y1);
    bump.context.lineTo(x2, y2);
    bump.context.stroke();
  }

  const stain = albedo.context.createRadialGradient(610, 430, 7, 610, 430, 62);
  stain.addColorStop(0, "rgba(63, 35, 22, 0.12)");
  stain.addColorStop(0.75, "rgba(63, 35, 22, 0.035)");
  stain.addColorStop(1, "rgba(63, 35, 22, 0)");
  albedo.context.fillStyle = stain;
  albedo.context.fillRect(530, 350, 160, 160);

  albedo.context.font = "italic 52px Georgia";
  albedo.context.fillStyle = "rgba(255, 219, 158, 0.18)";
  albedo.context.save();
  albedo.context.translate(760, 620);
  albedo.context.rotate(-0.15);
  albedo.context.fillText("A + R", 0, 0);
  albedo.context.restore();

  addFineNoise(
    albedo.context,
    size,
    random,
    "rgba(67, 29, 10, 0.05)",
    "rgba(255, 226, 174, 0.035)",
    2400,
  );
  return textureSet(albedo.canvas, roughness.canvas, bump.canvas, anisotropy);
}

export function createTileSurface(anisotropy: number): SurfaceTextureSet {
  const size = 1024;
  const tileCount = 20;
  const tileSize = size / tileCount;
  const grout = 1.8;
  const random = seededRandom(0x54494c45);
  const albedo = createCanvas(size);
  const roughness = createCanvas(size);
  const bump = createCanvas(size);

  albedo.context.fillStyle = "#8f918b";
  albedo.context.fillRect(0, 0, size, size);
  roughness.context.fillStyle = "#c7c7c7";
  roughness.context.fillRect(0, 0, size, size);
  bump.context.fillStyle = "#424242";
  bump.context.fillRect(0, 0, size, size);

  for (let row = 0; row < tileCount; row += 1) {
    for (let column = 0; column < tileCount; column += 1) {
      const x = column * tileSize + grout;
      const y = row * tileSize + grout;
      const inset = tileSize - grout * 2;
      const warmth = Math.round(random() * 10 - 5);
      const lightness = 218 + Math.round(random() * 12 - 6);
      albedo.context.fillStyle = `rgb(${lightness + warmth}, ${lightness + Math.round(warmth * 0.6)}, ${lightness - 8})`;
      albedo.context.fillRect(x, y, inset, inset);

      const sheen = albedo.context.createLinearGradient(x, y, x + inset, y + inset);
      sheen.addColorStop(0, "rgba(255,255,248,0.16)");
      sheen.addColorStop(0.5, "rgba(255,255,248,0.02)");
      sheen.addColorStop(1, "rgba(113,105,91,0.08)");
      albedo.context.fillStyle = sheen;
      albedo.context.fillRect(x, y, inset, inset);

      const tileRoughness = 148 + Math.round(random() * 22);
      roughness.context.fillStyle = `rgb(${tileRoughness},${tileRoughness},${tileRoughness})`;
      roughness.context.fillRect(x, y, inset, inset);
      bump.context.fillStyle = "#858585";
      bump.context.fillRect(x, y, inset, inset);

      if (random() > 0.82) {
        albedo.context.strokeStyle = "rgba(95, 91, 82, 0.12)";
        albedo.context.lineWidth = 1;
        albedo.context.beginPath();
        albedo.context.moveTo(x + inset * 0.2, y + inset * 0.67);
        albedo.context.lineTo(x + inset * 0.72, y + inset * 0.58);
        albedo.context.stroke();
      }
    }
  }

  addFineNoise(
    albedo.context,
    size,
    random,
    "rgba(83, 79, 70, 0.06)",
    "rgba(255, 255, 248, 0.08)",
    1800,
  );
  return textureSet(albedo.canvas, roughness.canvas, bump.canvas, anisotropy);
}

export function createPlasterSurface(anisotropy: number): SurfaceTextureSet {
  const size = 512;
  const random = seededRandom(0x57414c4c);
  const albedo = createCanvas(size);
  const roughness = createCanvas(size);
  const bump = createCanvas(size);

  const wash = albedo.context.createLinearGradient(0, 0, size, size);
  wash.addColorStop(0, "#b0b59f");
  wash.addColorStop(0.48, "#a6ad97");
  wash.addColorStop(1, "#969e89");
  albedo.context.fillStyle = wash;
  albedo.context.fillRect(0, 0, size, size);
  roughness.context.fillStyle = "#dedede";
  roughness.context.fillRect(0, 0, size, size);
  bump.context.fillStyle = "#808080";
  bump.context.fillRect(0, 0, size, size);

  for (let index = 0; index < 3600; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.4 + random() * 1.8;
    const light = random() > 0.5;
    albedo.context.fillStyle = light
      ? "rgba(255,255,235,0.035)"
      : "rgba(50,59,48,0.035)";
    albedo.context.fillRect(x, y, radius, radius);
    bump.context.fillStyle = light ? "#858585" : "#7a7a7a";
    bump.context.fillRect(x, y, radius, radius);
  }

  albedo.context.fillStyle = "rgba(79, 83, 70, 0.06)";
  for (let index = 0; index < 16; index += 1) {
    const x = random() * size;
    const y = size * (0.68 + random() * 0.28);
    albedo.context.beginPath();
    albedo.context.ellipse(x, y, 10 + random() * 34, 2 + random() * 7, random(), 0, Math.PI * 2);
    albedo.context.fill();
  }
  return textureSet(albedo.canvas, roughness.canvas, bump.canvas, anisotropy);
}
