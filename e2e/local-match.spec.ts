import { expect, test } from "@playwright/test";

async function enterMatch(
  page: import("@playwright/test").Page,
  { balanced = true }: { balanced?: boolean } = {},
) {
  if (balanced) {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        const result = originalMatchMedia(query);
        if (query !== "(pointer: coarse)") return result;
        return new Proxy(result, {
          get(target, property) {
            if (property === "matches") return true;
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      };
    });
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sharpener Fights" }),
  ).toBeVisible();
  const choices = page.getByRole("radio");
  await expect(choices).toHaveCount(6);
  await expect(page.locator('[data-part="sharpener-preview"] canvas')).toHaveCount(0);
  await page.getByRole("radio", { name: "Ocean Blue" }).click();
  await expect(page.getByRole("radio", { name: "Ocean Blue" })).toBeChecked();
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText(/Orange · 1[45]/)).toBeVisible();
}

test("presents a recognizable single-hole sharpener with horizontal automatic rotation", async ({
  page,
}) => {
  await page.goto("/");

  const preview = page.locator('[data-part="sharpener-preview"]');
  const spinner = page.locator('[data-part="rotating-sharpener"]');
  await expect(preview.locator("canvas")).toHaveCount(0);
  await expect(spinner).toBeVisible();
  await expect(page.locator('[data-part="sharpener-top-face"]')).toHaveCount(1);
  await expect(page.locator('[data-part="sharpener-bottom-face"]')).toHaveCount(1);
  await expect(page.locator('[data-part="sharpener-side"]')).toHaveCount(4);
  await expect(page.locator('[data-part="sharpener-molded-shoulder"]')).toHaveCount(1);
  await expect(page.locator('[data-part="sharpener-end-hole"]')).toHaveCount(1);
  await expect(page.locator('[data-part="sharpener-blade-channel"]')).toHaveCount(1);
  await expect(page.locator('[data-part="sharpener-blade-plate"]')).toHaveCount(1);
  await expect(page.locator('[data-part="sharpener-screw"]')).toHaveCount(1);
  await expect(preview.locator('[data-finish="plastic"]')).toHaveCount(1);
  await expect(spinner).toHaveAttribute("data-axis", "horizontal");
  await expect(spinner).toHaveCSS("animation-duration", "16s");
  await expect(spinner).toHaveCSS("animation-iteration-count", "infinite");

  await page.getByRole("radio", { name: "Aluminium" }).click();
  await expect(preview.locator('[data-finish="aluminium"]')).toHaveCount(1);
});

test("keeps the enclosed selector shell opaque across every cosmetic and extreme pose", async ({
  page,
}) => {
  await page.goto("/");

  const preview = page.locator('[data-part="interactive-sharpener-preview"]');
  const shell = page.locator('[data-part="enclosed-sharpener-body"]');
  const faces = shell.locator('[data-part="enclosed-sharpener-face"]');
  await expect(shell).toHaveCount(1);
  await expect(faces).toHaveCount(6);

  const cosmetics = [
    "Ember Red",
    "Ocean Blue",
    "Sunflower",
    "Classroom Green",
    "Graphite",
    "Aluminium",
  ];
  const poses = [
    { x: -18, y: -38 },
    { x: 88, y: 0 },
    { x: 178, y: 24 },
    { x: -72, y: 90 },
  ];

  for (const cosmetic of cosmetics) {
    await page.getByRole("radio", { name: cosmetic, exact: true }).click();
    for (const pose of poses) {
      await preview.evaluate((element, nextPose) => {
        const node = element as HTMLElement;
        node.style.setProperty("--preview-rotate-x", `${nextPose.x}deg`);
        node.style.setProperty("--preview-rotate-y", `${nextPose.y}deg`);
      }, pose);

      const everyFaceIsOpaque = await faces.evaluateAll((elements) =>
        elements.every((element) => {
          const style = getComputedStyle(element);
          return (
            style.backgroundImage !== "none" ||
            style.backgroundColor !== "rgba(0, 0, 0, 0)"
          );
        }),
      );
      expect(everyFaceIsOpaque).toBe(true);
    }
  }
});

test("lets the player rotate the preview across both axes", async ({ page }) => {
  await page.goto("/");

  const preview = page.locator('[data-part="interactive-sharpener-preview"]');
  const spinner = page.locator('[data-part="rotating-sharpener"]');
  const initialRotation = await preview.evaluate((element) => ({
    x: element.style.getPropertyValue("--preview-rotate-x"),
    y: element.style.getPropertyValue("--preview-rotate-y"),
  }));
  const bounds = await preview.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(preview).toHaveAttribute("data-dragging", "true");
  await expect(preview).toHaveAttribute("data-auto-paused", "true");
  await expect(spinner).toHaveCSS("animation-play-state", "paused");
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 52,
    bounds.y + bounds.height / 2 + 38,
    { steps: 4 },
  );

  const draggedRotation = await preview.evaluate((element) => ({
    x: element.style.getPropertyValue("--preview-rotate-x"),
    y: element.style.getPropertyValue("--preview-rotate-y"),
  }));
  expect(draggedRotation.x).not.toBe(initialRotation.x);
  expect(draggedRotation.y).not.toBe(initialRotation.y);

  await page.mouse.up();
  await expect(preview).toHaveAttribute("data-dragging", "false");
  await expect(preview).toHaveAttribute("data-auto-paused", "false", {
    timeout: 1_500,
  });
  await expect(spinner).toHaveCSS("animation-play-state", "running");
});

test("holds the selector at a dimensional pose when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const spinner = page.locator('[data-part="rotating-sharpener"]');
  await expect(spinner).toHaveCSS("animation-name", "none");
  await expect(spinner).not.toHaveCSS("transform", "none");
});

test("selects a fair cosmetic and releases a pointer drag as a shot", async ({
  page,
}) => {
  await enterMatch(page);

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/Orange · \d+/)).toBeVisible();
  await expect(page.getByText("Round 1. Orange 0, Blue 0.")).toBeAttached();
  await expect(page.getByText("Nostalgic Website Part 1")).toHaveCount(0);
  await expect(page.locator('[data-layer="static-classroom"]')).toBeAttached();
  await expect(page.locator('[data-part="classroom-blackboard"]')).toBeAttached();
  await expect(page.locator('[data-part="classroom-desk"]')).toBeAttached();

  const arena = await canvas.boundingBox();
  expect(arena).not.toBeNull();
  if (!arena) return;

  const startX = arena.x + arena.width / 2;
  const startY = arena.y + arena.height * 0.671;
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
  await expect(page.getByRole("button", { name: "Sound settings" })).toBeVisible();
  await expect(page.getByText(/rotate your phone/i)).toHaveCount(0);
});

test("keeps classroom decoration outside the aiming interaction path", async ({
  page,
}) => {
  await enterMatch(page);

  const canvas = page.locator("canvas");
  const arena = await canvas.boundingBox();
  expect(arena).not.toBeNull();
  if (!arena) return;

  await page.mouse.click(
    arena.x + arena.width * 0.9,
    arena.y + arena.height * 0.58,
  );
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
  await expect(page.locator('[data-part="power-meter"]')).toHaveAttribute(
    "aria-label",
    "Shot power 0%",
  );

  const startX = arena.x + arena.width / 2;
  const startY = arena.y + arena.height * 0.671;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(
    arena.x + arena.width * 0.87,
    arena.y + arena.height * 0.82,
    { steps: 10 },
  );
  await page.mouse.up();

  await expect(
    page.locator("[data-phase='MOVING'], [data-phase='SETTLING']"),
  ).toBeVisible({ timeout: 2_000 });
});

test("plays the supplied background track and keeps independent audio controls across screens", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const result = originalMatchMedia(query);
      if (query !== "(pointer: coarse)") return result;
      return new Proxy(result, {
        get(target, property) {
          if (property === "matches") return true;
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    };
    const playedAudio: string[] = [];
    Object.defineProperty(window, "__sharpenerPlayedAudio", {
      value: playedAudio,
    });
    HTMLMediaElement.prototype.play = function play() {
      playedAudio.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {};
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Sound settings" }).click();
  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __sharpenerPlayedAudio: string[] })
        .__sharpenerPlayedAudio,
    ),
  ).toContain("/audio/PlayGround-BG.mp3");

  const playCount = (asset: string) =>
    page.evaluate((path) =>
      (window as typeof window & { __sharpenerPlayedAudio: string[] })
        .__sharpenerPlayedAudio.filter((played) => played === path).length,
    asset);

  await page.getByRole("radio", { name: "Ember Red" }).click();
  expect(await playCount("/audio/Selection-click.mp3")).toBe(0);
  await page.getByRole("radio", { name: "Ocean Blue" }).click();
  await expect.poll(() => playCount("/audio/Selection-click.mp3")).toBe(1);
  await page.getByRole("radio", { name: "Ocean Blue" }).click();
  expect(await playCount("/audio/Selection-click.mp3")).toBe(1);

  await page.getByRole("button", { name: "Lock in" }).click();
  await expect.poll(() => playCount("/audio/Lock-IN-sound.mp3")).toBe(1);
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();

  await page.getByRole("button", { name: "Mute background music" }).click();
  await page.getByRole("button", { name: "Mute sound effects" }).click();
  await expect(page.getByRole("button", { name: "Unmute background music" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unmute sound effects" })).toBeVisible();

  await page.getByRole("button", { name: "Unmute sound effects" }).click();
  await expect(page.getByRole("button", { name: "Mute sound effects" })).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText(/Orange · 1[45]/)).toBeVisible();
  const canvas = page.locator("canvas");
  const arena = await canvas.boundingBox();
  expect(arena).not.toBeNull();
  if (!arena) return;
  const startX = arena.x + arena.width / 2;
  const startY = arena.y + arena.height * 0.671;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(
    arena.x + arena.width * 0.87,
    arena.y + arena.height * 0.82,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    page.locator("[data-phase='MOVING'], [data-phase='SETTLING']"),
  ).toBeVisible({ timeout: 2_000 });
  await expect.poll(() => playCount("/audio/Sharpener-click.mp3")).toBe(1);

  for (const asset of [
    "PlayGround-BG.mp3",
    "Selection-click.mp3",
    "Lock-IN-sound.mp3",
    "Sharpener-click.mp3",
    "School-Bell.mp3",
    "Winner-Effect.mp3",
    "sharpener-collision.mp3",
  ]) {
    const response = await page.request.get(`/audio/${asset}`);
    expect(response.ok()).toBe(true);
  }
});

test("shows final statistics, plays both victory tracks once, and can play again", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const playedAudio: string[] = [];
    const pausedAudio: string[] = [];
    Object.defineProperties(window, {
      __sharpenerPlayedAudio: { value: playedAudio },
      __sharpenerPausedAudio: { value: pausedAudio },
    });
    HTMLMediaElement.prototype.play = function play() {
      playedAudio.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      pausedAudio.push(new URL(this.src).pathname);
    };

    const body = (player: 0 | 1, eliminated: boolean) => ({
      player,
      position: { x: 0, y: eliminated ? -1 : 0.02, z: player ? -0.36 : 0.36 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      eliminated,
    });
    const finalSnapshot = {
      matchId: "local-match",
      tick: 12_000,
      phase: "MATCH_OVER",
      roundId: 4,
      turnId: 17,
      activePlayer: 0,
      aimingTicksRemaining: 0,
      scores: [3, 1],
      roundWinner: 0,
      matchWinner: 0,
      shotCount: 3,
      sharpeners: [body(0, false), body(1, true)],
    };
    const aimingSnapshot = {
      ...finalSnapshot,
      tick: 0,
      phase: "AIMING",
      roundId: 1,
      turnId: 1,
      aimingTicksRemaining: 1_800,
      scores: [0, 0],
      roundWinner: null,
      matchWinner: null,
      shotCount: 0,
      sharpeners: [body(0, false), body(1, false)],
    };

    class FakeGameWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      constructor() {
        window.setTimeout(() => {
          this.onmessage?.(
            new MessageEvent("message", {
              data: { type: "READY", snapshot: finalSnapshot },
            }),
          );
        });
      }

      postMessage(message: { type?: string }) {
        if (message.type !== "RESET") return;
        window.setTimeout(() => {
          this.onmessage?.(
            new MessageEvent("message", {
              data: { type: "SNAPSHOT", snapshot: aimingSnapshot, events: [] },
            }),
          );
        });
      }

      terminate() {}
    }

    window.Worker = FakeGameWorker as unknown as typeof Worker;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Lock in" }).click();

  const winner = page.getByRole("dialog", { name: "Orange wins!" });
  await expect(winner).toBeVisible();
  await expect(winner).toContainText("3–1");
  await expect(winner).toContainText("Rounds4");
  await expect(winner).toContainText("Turns17");
  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __sharpenerPlayedAudio: string[] })
        .__sharpenerPlayedAudio,
    ),
  ).toEqual(expect.arrayContaining([
    "/audio/School-Bell.mp3",
    "/audio/Winner-Effect.mp3",
  ]));

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(winner).toHaveCount(0);
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __sharpenerPausedAudio: string[] })
        .__sharpenerPausedAudio,
    ),
  ).toEqual(expect.arrayContaining([
    "/audio/School-Bell.mp3",
    "/audio/Winner-Effect.mp3",
  ]));
});

test("cancels a held drag when its authoritative turn expires", async ({
  page,
}) => {
  test.setTimeout(40_000);
  await enterMatch(page);

  const canvas = page.locator("canvas");
  const arena = await canvas.boundingBox();
  expect(arena).not.toBeNull();
  if (!arena) return;

  const startX = arena.x + arena.width / 2;
  const startY = arena.y + arena.height * 0.671;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + arena.height * 0.1, { steps: 6 });
  await expect(page.locator('[data-part="power-meter"]')).not.toHaveAttribute(
    "aria-label",
    "Shot power 0%",
  );

  await expect(page.getByText(/Blue · \d+/)).toBeVisible({ timeout: 17_000 });
  await page.mouse.up();

  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
  await expect(page.locator('[data-part="power-meter"]')).toHaveAttribute(
    "aria-label",
    "Shot power 0%",
  );
});

test("reset invalidates a held drag before its pointer is released", async ({
  page,
}) => {
  await enterMatch(page);

  const canvas = page.locator("canvas");
  const arena = await canvas.boundingBox();
  expect(arena).not.toBeNull();
  if (!arena) return;

  const startX = arena.x + arena.width / 2;
  const startY = arena.y + arena.height * 0.671;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + arena.height * 0.1, { steps: 6 });
  await expect(page.locator('[data-part="power-meter"]')).not.toHaveAttribute(
    "aria-label",
    "Shot power 0%",
  );

  await page.getByRole("button", { name: "Reset" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await page.mouse.up();

  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
  await expect(page.locator('[data-part="power-meter"]')).toHaveAttribute(
    "aria-label",
    "Shot power 0%",
  );
});

test("falls back to balanced rendering when high-tier effects are unsupported", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function getExtension(
      name: string,
    ) {
      if (name === "EXT_color_buffer_float") return null;
      return original.call(this, name);
    };
  });

  await enterMatch(page, { balanced: false });

  await expect(page.locator("[data-quality='balanced']")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("[data-phase='AIMING']")).toBeVisible();
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

  await expect(page.locator('canvas[data-layer="arena-canvas"]')).toHaveCount(0);
  await expect(page.locator('[data-layer="static-classroom"]')).toBeVisible();
  await expect(page.locator('[data-part="classroom-blackboard"]')).toBeVisible();
  await expect(page.locator('[data-part="classroom-floor"]')).toBeVisible();
  await expect(page.locator('[data-part="classroom-desk"]')).toBeVisible();
  await expect(page.locator('[data-part="classroom-perimeter"]')).toBeVisible();
  await expect(page.locator('[data-part="classroom-date"]')).toHaveText(
    /^\d{2}\/\d{2}\/\d{4}$/,
  );
  await expect(page.getByRole("status", { name: "3D unavailable" })).toBeVisible();
});
