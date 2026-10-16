import "server-only";

/**
 * A small sliding-window limiter, per server instance. It stops one browser
 * from hammering the LLM endpoints; the real protection is the Vercel WAF
 * rate-limit rule and the AI Gateway budget (architecture.md).
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): { ok: boolean; retryAfterS: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterS: Math.ceil((windowMs - (now - recent[0])) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) hits.clear(); // bound memory
      return { ok: true, retryAfterS: 0 };
    },
  };
}

/** Week plans (POST /api/week): 6 per 10 minutes per IP. */
export const planLimiter = createRateLimiter(6, 10 * 60_000);

export type RateLimiter = ReturnType<typeof createRateLimiter>;

/** Fresh agent runs (a new model run; joining or replaying a run doesn't count): 5 per hour per IP. */
export const FRESH_RUNS_PER_HOUR = 5;
export const freshRunLimiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);

export type FreshRunGate = { ok: true } | { ok: false; retryAfterS: number; message: string };

/**
 * Whether this request may start a fresh agent run. Replays and joined runs (`reused`) are free and never counted;
 * offline test mode spends nothing and isn't limited (the e2e tests share one IP). Per instance, like every limiter
 * here: the Vercel WAF rule on /api/plan (docs/deploy.md) is the cross-instance limit.
 */
export function freshRunGate(
  { reused, offline, ip, timeZone }: { reused: boolean; offline: boolean; ip: string; timeZone: string },
  limiter: RateLimiter = freshRunLimiter,
  now = Date.now(),
): FreshRunGate {
  if (reused || offline) return { ok: true };
  const result = limiter.check(ip, now);
  if (result.ok) return { ok: true };
  const at = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone }).format(now + result.retryAfterS * 1000);
  return {
    ok: false,
    retryAfterS: result.retryAfterS,
    message: `You've started ${FRESH_RUNS_PER_HOUR} plans this hour. Open one of your earlier plans, or try again at ${at}.`,
  };
}
/** Plain-LLM comparisons: 12 per 10 minutes per IP (cached, cheap model). */
export const compareLimiter = createRateLimiter(12, 10 * 60_000);
/** Live search (Spotify, Last.fm): 120 per minute per IP; the picker debounces typing. */
export const repertoireLimiter = createRateLimiter(120, 60_000);
/** New short plan links: 30 per 10 minutes per IP (reused links aren't counted). */
export const planLinkLimiter = createRateLimiter(30, 10 * 60_000);
