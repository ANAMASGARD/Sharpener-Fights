import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-pwa",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3200",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "allow",
  },
  webServer: {
    command: "npm run start --workspace=@sharpener/web -- --port 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
