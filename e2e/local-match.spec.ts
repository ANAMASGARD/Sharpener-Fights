import { expect, test } from "@playwright/test";

async function enterMatch(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sharpener Fights" }),
  ).toBeVisible();
  const choices = page.getByRole("radio");
  await expect(choices).toHaveCount(6);
  await expect(page.locator(".preview-well canvas")).toHaveCount(0);
  await page.getByRole("radio", { name: "Ocean Blue" }).click();
  await expect(page.getByRole("radio", { name: "Ocean Blue" })).toBeChecked();
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
}

test("selects a fair cosmetic and releases a pointer drag as a shot", async ({
  page,
}) => {
  await enterMatch(page);

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/Orange · \d+/)).toBeVisible();
  await expect(page.getByText("Round 1. Orange 0, Blue 0.")).toBeAttached();
  await expect(page.getByText("Nostalgic Website Part 1")).toHaveCount(0);
  await expect(page.locator(".classroom-fallback")).toBeAttached();
  await expect(page.locator(".fallback-blackboard")).toBeAttached();
  await expect(page.locator(".fallback-desk")).toBeAttached();

  const arena = await canvas.boundingBox();
  expect(arena).not.toBeNull();
  if (!arena) return;

  const startX = arena.x + arena.width / 2;
  const startY = arena.y + arena.height * 0.62;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + arena.height * 0.13, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator("[data-phase='MOVING'], [data-phase='SETTLING']")).toBeVisible({
    timeout: 2_000,
  });
});

test("keeps the full match interface usable in portrait without a rotate gate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterMatch(page);

  await expect(page.locator("canvas")).toHaveCSS("height", "844px");
  await expect(page.getByRole("button", { name: "Change sharpener" })).toBeVisible();
  await expect(page.getByRole("button", { name: "SFX on" })).toBeVisible();
  await expect(page.getByText(/rotate your phone/i)).toHaveCount(0);
});

test("shows the complete classroom instead of a blank screen when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") return null;
      return Reflect.apply(originalGetContext, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await enterMatch(page);

  await expect(page.locator(".arena-canvas")).toHaveCount(0);
  await expect(page.locator(".classroom-fallback")).toBeVisible();
  await expect(page.locator(".fallback-blackboard")).toBeVisible();
  await expect(page.locator(".fallback-tile-floor")).toBeVisible();
  await expect(page.locator(".fallback-desk")).toBeVisible();
  await expect(page.getByRole("status", { name: "3D unavailable" })).toBeVisible();
});
