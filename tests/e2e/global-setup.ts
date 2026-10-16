import type { FullConfig } from "@playwright/test";
import { guardMode, guardVerdict } from "./guard";

/**
 * Guards against spending real money (decision in ./guard.ts). Locally Playwright reuses any server already on
 * the e2e port (reuseExistingServer), and PLAYWRIGHT_BASE_URL can point at a local dev server too: a local server
 * must report offline: true on GET /api/health before any spec runs, unless E2E_ALLOW_LIVE=1. Against a remote
 * deploy, warn instead: those runs are deliberate.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? config.projects[0]?.use.baseURL ?? "";
  const mode = guardMode(baseURL, { external: Boolean(process.env.PLAYWRIGHT_BASE_URL), allowLive: process.env.E2E_ALLOW_LIVE === "1" });
  if (mode === "warn") {
    console.warn(`e2e against ${baseURL}: specs that aren't skipped will call the real agent (Claude, Qloo, Ticketmaster) on uncached example plans.`);
    return;
  }
  let offline: boolean | null = null;
  try {
    const response = await fetch(new URL("/api/health", baseURL), { cache: "no-store" });
    offline = response.ok && (await response.json())?.offline === true ? true : null;
  } catch {
    offline = null;
  }
  const verdict = guardVerdict(mode, offline);
  if (verdict === "warn") {
    console.warn(
      [
        "!".repeat(78),
        `E2E_ALLOW_LIVE=1: the server at ${baseURL} is NOT offline. The specs will call real, paid APIs`,
        "(Claude via AI Gateway, Qloo, Ticketmaster) and spend money on every uncached plan.",
        "!".repeat(78),
      ].join("\n"),
    );
  }
  if (verdict === "abort") {
    const port = URL.canParse(baseURL) ? new URL(baseURL).port : "";
    const where = port ? `on port ${port}` : `at ${baseURL}`;
    throw new Error(
      `e2e aborted: the server ${where} is not in offline mode (GET /api/health did not report offline: true), ` +
        `so the tests would call real, paid APIs. Stop that server or free the port and run again (Playwright starts its own ` +
        "offline server), or set E2E_ALLOW_LIVE=1 if you really mean to spend money.",
    );
  }
}
