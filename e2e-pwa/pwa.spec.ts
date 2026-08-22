import { expect, test } from "@playwright/test";

test("publishes the install manifest and zoomable mobile viewport", async ({ page, request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "Sharpener Fights",
    short_name: "SharpFights",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", purpose: "any" }),
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  ]));

  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("width=device-width");
  expect(viewport).not.toContain("maximum-scale");
  expect(viewport).not.toContain("user-scalable=no");
});

test("installs the public game shell and keeps Local Play available offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sharpener Fights" })).toBeVisible();

  await page.goto("/play/local");
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
});

test("defers a native install prompt until engagement and shows the branded desk ticket", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    Object.assign(event, {
      prompt: async () => { (window as typeof window & { __installPrompted?: boolean }).__installPrompted = true; },
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });
    window.dispatchEvent(event);
  });
  await page.locator("body").click({ position: { x: 8, y: 100 } });
  await expect(page.getByTestId("install-ticket")).toHaveCount(0);
  await expect(page.getByTestId("install-ticket")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Install Sharpener Fights" })).toBeVisible();
  await expect(page.getByTestId("install-ticket").locator('img[src*="sharpener-fights-logo"]')).toBeVisible();
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { __installPrompted?: boolean }).__installPrompted))).toBe(true);
});
