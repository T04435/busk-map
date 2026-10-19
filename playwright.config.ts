import { defineConfig, devices } from "@playwright/test";
import { FAKE_NOW } from "./tests/e2e/clock";

/**
 * Judge-path e2e tests.
 *
 * - Locally and in CI: builds and starts the app with the test switches on
 *   (fault injection, offline fixtures and mock AI), so tests are deterministic and cost nothing.
 * - Against a deploy: set PLAYWRIGHT_BASE_URL and E2E_ALLOW_LIVE=1 (and, for protected previews,
 *   VERCEL_AUTOMATION_BYPASS_SECRET). Fault and mock tests skip themselves there.
 * - Cost guard (tests/e2e/global-setup.ts): every run first calls GET <baseURL>/api/health, whatever the host.
 *   Unless it reports offline: true, the run aborts. E2E_ALLOW_LIVE=1 overrides that with a loud cost warning; a
 *   deploy is never offline, so deploy runs always need it.
 */
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PORT ?? 3100);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  // Aborts unless GET /api/health reports offline: true, on any host; E2E_ALLOW_LIVE=1 runs anyway, with a warning.
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
          // The server clock is frozen at Wednesday noon in Melbourne (honoured only with the fault switch above), so
          // default dates and "slot passed" never depend on the time of day the suite runs. The Friday 5-8 pm example
          // opens on 16 Oct, Saturday ones on 17 Oct. Specs that need another moment can change it here.
          BUSKMAP_FAKE_NOW: FAKE_NOW,
        },
      },
});
