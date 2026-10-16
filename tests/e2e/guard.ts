/**
 * The e2e cost guard's decision (B-001, B-008), pure so it can be unit-tested.
 *
 * - A local server (Playwright's own, a reused one, or PLAYWRIGHT_BASE_URL on localhost, 127.0.0.1, [::1] or
 *   *.localhost) is checked: GET /api/health must report offline: true, or the run aborts.
 * - E2E_ALLOW_LIVE=1 skips the abort for a local server, with a loud cost warning.
 * - A remote PLAYWRIGHT_BASE_URL (a deploy) only warns: those runs are deliberate.
 */
export type GuardMode = "check" | "allow-live" | "warn";
export type GuardVerdict = "run" | "warn" | "abort";

export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || host.endsWith(".localhost");
}

/** How to guard a run against `baseURL`; `external` when it came from PLAYWRIGHT_BASE_URL. */
export function guardMode(baseURL: string, env: { external: boolean; allowLive: boolean }): GuardMode {
  let local: boolean;
  try {
    local = !env.external || isLocalHost(new URL(baseURL).hostname);
  } catch {
    local = true; // An unparseable URL is never treated as a deploy.
  }
  if (!local) return "warn";
  return env.allowLive ? "allow-live" : "check";
}

/** The outcome for a mode and what /api/health said (offline: true, or null when it didn't say so). */
export function guardVerdict(mode: GuardMode, offline: boolean | null): GuardVerdict {
  if (mode === "check") return offline === true ? "run" : "abort";
  if (mode === "allow-live") return offline === true ? "run" : "warn";
  return "warn";
}
