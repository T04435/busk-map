import { defineConfig, devices } from "@playwright/test";

/**
 * Judge-path e2e tests.
 *
 * - Locally and in CI: builds and starts the app with the test switches on
 *   (fault injection, offline fixtures and mock AI), so tests are deterministic and cost nothing.
 * - Against a deploy: set PLAYWRIGHT_BASE_URL (and, for protected previews,
 *   VERCEL_AUTOMATION_BYPASS_SECRET). Fault and mock tests skip themselves there.
 */
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PORT ?? 3100);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  // Aborts locally unless the server on the e2e port is offline (GET /api/health); warns against a deploy.
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    extraHTTPHeaders: bypass
      ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        // Own build directory, so an e2e build never overwrites the .next under another running server.
        command: `pnpm build && pnpm start --port ${port}`,
        port,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-e2e",
          BUSKMAP_ALLOW_FAULTS: "1",
          // Deterministic and free: synthetic fixtures for every provider, mock AI.
          BUSKMAP_OFFLINE: "1",
        },
      },
});
