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

/** Live agent runs: 6 per 10 minutes per IP. */
export const planLimiter = createRateLimiter(6, 10 * 60_000);
/** Plain-LLM comparisons: 12 per 10 minutes per IP (cached, cheap model). */
export const compareLimiter = createRateLimiter(12, 10 * 60_000);
/** Live search (Spotify, Last.fm): 120 per minute per IP; the picker debounces typing. */
export const repertoireLimiter = createRateLimiter(120, 60_000);
/** New short plan links: 30 per 10 minutes per IP (reused links aren't counted). */
export const planLinkLimiter = createRateLimiter(30, 10 * 60_000);
