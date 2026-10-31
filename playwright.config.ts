import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3210";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "on-first-retry" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "chromium-phone", use: { ...devices["Pixel 5"] } },
  ],
  // Runs the production standalone build with AI switched off: E2E never reaches the live model.
  webServer: {
    command: "node scripts/serve-standalone.mjs",
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: port, HOSTNAME: "127.0.0.1", AI_ENABLED: "false" },
  },
});
