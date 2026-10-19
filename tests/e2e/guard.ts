/**
 * The e2e cost guard's decision (B-001, B-008, B-009), pure so it can be unit-tested.
 *
 * The hostname plays no part: localhost, 0.0.0.0, a LAN IP, <machine>.local and a remote deploy are all treated
 * the same, because any of them can be a live server that spends money.
 *
 * - Every run first calls GET `${baseURL}/api/health`.
 * - It reports offline: true → run.
 * - Otherwise (not offline, unreachable, no health route) → abort, unless E2E_ALLOW_LIVE=1, which runs with a loud
 *   cost warning. So a run against a deploy (PLAYWRIGHT_BASE_URL) needs E2E_ALLOW_LIVE=1 as well.
 */
export type GuardVerdict = "run" | "warn" | "abort";

/** What /api/health said: "offline" (offline: true), "live" (answered, not offline), "unreachable" (no answer, error or no route). */
export type HealthResult = "offline" | "live" | "unreachable";

/** The outcome for a health result and the E2E_ALLOW_LIVE override. */
export function guardVerdict(health: HealthResult, allowLive: boolean): GuardVerdict {
  if (health === "offline") return "run";
  return allowLive ? "warn" : "abort";
}

/** Calls GET `${baseURL}/api/health` and classifies the answer. Never throws. */
export async function checkHealth(baseURL: string, fetchImpl: typeof fetch = fetch): Promise<HealthResult> {
  try {
    const response = await fetchImpl(new URL("/api/health", baseURL), { cache: "no-store" });
    if (!response.ok) return "unreachable";
    const body: unknown = await response.json().catch(() => null);
    return body && typeof body === "object" && (body as { offline?: unknown }).offline === true ? "offline" : "live";
  } catch {
    return "unreachable";
  }
}

/** The full decision for a base URL: health check, then the verdict. */
export async function decideGuard(baseURL: string, env: { allowLive: boolean }, fetchImpl: typeof fetch = fetch) {
  const health = await checkHealth(baseURL, fetchImpl);
  return { health, verdict: guardVerdict(health, env.allowLive) };
}
