/**
 * QA[busk-map] Playwright config: QA's specs (tests/e2e/qa/) at the three widths every screen must work at
 * (user rule via BRAND): 390, 768 and 1440 px, actually rendered.
 *
 * Reuses DEV's config (offline webServer with mock AI, the /api/health cost guard) and changes only the projects,
 * the test folder and the build directory. QA never edits DEV's playwright.config.ts.
 *
 * Run: CI=1 PORT=<free port> pnpm exec playwright test --config qa/playwright.config.ts
 */
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import base from "../playwright.config";

// Playwright loads this config as CommonJS, so __dirname is defined.
const repo = path.resolve(__dirname, "..");

export default defineConfig({
  ...base,
  testDir: "../tests/e2e/qa",
  outputDir: "../test-results/qa",
  globalSetup: "../tests/e2e/global-setup.ts",
  projects: [
    { name: "w390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "w768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "w1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: base.webServer && !Array.isArray(base.webServer)
    ? { ...base.webServer, cwd: repo, env: { ...base.webServer.env, NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-qa-e2e" } }
    : base.webServer,
});
