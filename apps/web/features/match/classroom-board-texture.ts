import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
} from "three";

type ChalkTextOptions = {
  align?: CanvasTextAlign;
  color?: string;
  font: string;
  seed: number;
};

function seededRandom(initialSeed: number) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export function formatBoardDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function drawChalkText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  { align = "left", color = "#f2ead5", font, seed }: ChalkTextOptions,
) {
  const random = seededRandom(seed);
  context.save();
  context.font = font;
  context.textAlign = align;
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.shadowColor = "rgba(245, 239, 218, 0.16)";
  context.shadowBlur = 5;

  for (let pass = 0; pass < 4; pass += 1) {
    context.globalAlpha = pass === 0 ? 0.72 : 0.18;
    context.fillStyle = color;
    context.fillText(
      text,
      x + (random() - 0.5) * 2.2,
      y + (random() - 0.5) * 1.6,
    );
  }

  const metrics = context.measureText(text);
  const width = metrics.width;
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  const fontSize = Number.parseFloat(font.match(/\d+(?:\.\d+)?px/)?.[0] ?? "24");
  context.shadowBlur = 0;
  context.fillStyle = color;
  for (let index = 0; index < Math.max(16, Math.floor(width / 7)); index += 1) {
    context.globalAlpha = 0.08 + random() * 0.16;
    const radius = 0.35 + random() * 1.1;
    context.fillRect(
      left + random() * width,
      y - fontSize * (0.86 + random() * 0.14),
      radius,
      radius,
    );
  }
  context.restore();
}

export function createScoreTexture({
  roundId,
  turnId,
  scoreZero,
  scoreOne,
  sceneDate,
}: {
  roundId: number;
  turnId: number;
  scoreZero: number;
  scoreOne: number;
  sceneDate: Date;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 420;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable");
  const random = seededRandom(0x4348414c);

  const gradient = context.createLinearGradient(0, 0, 1024, 420);
  gradient.addColorStop(0, "#0c1817");
  gradient.addColorStop(0.48, "#172725");
  gradient.addColorStop(1, "#0a1414");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 420);

  for (let index = 0; index < 54; index += 1) {
    const y = 15 + random() * 390;
    const x = random() * 250;
    context.globalAlpha = 0.025 + random() * 0.075;
    context.strokeStyle = "#e5e6d5";
    context.lineWidth = 1 + random() * 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(1000, x + 270 + random() * 560), y + random() * 3 - 1.5);
    context.stroke();
  }

  const haze = context.createRadialGradient(508, 205, 20, 508, 205, 360);
  haze.addColorStop(0, "rgba(225, 228, 208, 0.045)");
  haze.addColorStop(1, "rgba(225, 228, 208, 0)");
  context.globalAlpha = 1;
  context.fillStyle = haze;
  context.fillRect(80, 12, 860, 390);

  drawChalkText(context, "SHARPENER FIGHTS", 512, 82, {
    align: "center",
    font: "700 62px Georgia, serif",
    seed: 11,
  });
  drawChalkText(context, formatBoardDate(sceneDate), 952, 47, {
    align: "right",
    color: "#e7dfc9",
    font: "700 23px Courier New, monospace",
    seed: 13,
  });
  drawChalkText(context, `ROUND ${roundId}  ·  BEST OF FIVE`, 512, 129, {
    align: "center",
    color: "#d6c56f",
    font: "700 28px Courier New, monospace",
    seed: 17,
  });
  drawChalkText(context, "ORANGE", 120, 226, {
    font: "700 38px Courier New, monospace",
    seed: 19,
  });
  drawChalkText(context, "BLUE", 120, 304, {
    font: "700 38px Courier New, monospace",
    seed: 23,
  });
  drawChalkText(context, String(scoreZero), 390, 229, {
    color: "#ee9c54",
    font: "700 52px Courier New, monospace",
    seed: 29,
  });
  drawChalkText(context, String(scoreOne), 390, 307, {
    color: "#65bfd1",
    font: "700 52px Courier New, monospace",
    seed: 31,
  });

  context.globalAlpha = 0.32;
  context.strokeStyle = "#f2e9d5";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(500, 175);
  context.lineTo(500, 330);
  context.stroke();
  context.globalAlpha = 1;
  drawChalkText(context, "TURN", 566, 215, {
    font: "600 27px Courier New, monospace",
    seed: 37,
  });
  drawChalkText(context, String(turnId), 566, 282, {
    font: "700 52px Courier New, monospace",
    seed: 41,
  });

  const trayDust = context.createLinearGradient(0, 350, 0, 420);
  trayDust.addColorStop(0, "rgba(240, 235, 215, 0)");
  trayDust.addColorStop(1, "rgba(240, 235, 215, 0.08)");
  context.fillStyle = trayDust;
  context.fillRect(0, 350, 1024, 70);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}
