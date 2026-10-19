import type { FullConfig } from "@playwright/test";
import { decideGuard } from "./guard";

/**
 * Guards against spending real money (decision in ./guard.ts). Whatever the host (Playwright's own server, a
 * reused one on the e2e port, or PLAYWRIGHT_BASE_URL pointing at a dev server or a deploy), the server must report
 * offline: true on GET /api/health before any spec runs. Otherwise the run aborts, unless E2E_ALLOW_LIVE=1, which
 * runs with a loud cost warning.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? config.projects[0]?.use.baseURL ?? "";
  const { health, verdict } = await decideGuard(baseURL, { allowLive: process.env.E2E_ALLOW_LIVE === "1" });
  if (verdict === "run") return;
  const said = health === "unreachable" ? "could not be reached or has no health route" : "did not report offline: true";
  if (verdict === "warn") {
    console.warn(
      [
        "!".repeat(78),
        `E2E_ALLOW_LIVE=1: the server at ${baseURL} is NOT offline (GET /api/health ${said}).`,
        "Specs that aren't skipped will call real, paid APIs (Claude via AI Gateway, Qloo, Ticketmaster)",
        "and spend money on every uncached plan.",
        "!".repeat(78),
      ].join("\n"),
    );
    return;
  }
  throw new Error(
    `e2e aborted: the server at ${baseURL} is not in offline mode (GET /api/health ${said}), ` +
      "so the tests would call real, paid APIs. Stop that server or free the port and run again (Playwright starts its own " +
      "offline server), or set E2E_ALLOW_LIVE=1 if you really mean to spend money (required for runs against a deploy).",
  );
}
