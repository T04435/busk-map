import type { FullConfig } from "@playwright/test";

/**
 * Guards against spending real money. Locally Playwright reuses any server already on the e2e
 * port (reuseExistingServer), so check that it runs on offline fixtures before any spec does.
 * Against a deploy (PLAYWRIGHT_BASE_URL), warn instead: those runs are deliberate.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (process.env.PLAYWRIGHT_BASE_URL) {
    console.warn(
      `e2e against ${process.env.PLAYWRIGHT_BASE_URL}: specs that aren't skipped will call the real agent (Claude, Qloo, Ticketmaster) on uncached example plans.`,
    );
    return;
  }
  const port = baseURL ? new URL(baseURL).port : "?";
  let health: { offline?: unknown } | null = null;
  try {
    const response = await fetch(`${baseURL}/api/health`, { cache: "no-store" });
    health = response.ok ? await response.json() : null;
  } catch {
    health = null;
  }
  if (health?.offline !== true) {
    throw new Error(
      `e2e aborted: the server on port ${port} is not in offline mode (GET /api/health did not report offline: true), ` +
        `so the tests would call real, paid APIs. Stop the server on port ${port} or free the port, then run again; ` +
        "Playwright will start its own offline server.",
    );
  }
}
