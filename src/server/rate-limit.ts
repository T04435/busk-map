import "server-only";
import type { LearnLimitScope } from "@/lib/learn-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { LEARN_RUNS_PER_HOUR_PER_IP, LEARN_UNCOUNTED_END_CODES, LEARN_RUNS_PER_HOUR_PER_PLAYLIST, LEARN_WINDOW_MINUTES, PLAN_UNCOUNTED_END_CODES, PLAYLIST_CREATIONS_PER_HOUR } from "@/server/playlist/config";

/**
 * A small sliding-window limiter, per server instance. It stops one browser
 * from hammering the LLM endpoints; the real protection is the Vercel WAF
 * rate-limit rule and the AI Gateway budget (architecture.md).
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Whether `check` would allow this key now, without recording a hit. */
    peek(key: string, now = Date.now()): { ok: boolean; retryAfterS: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      return recent.length >= limit ? { ok: false, retryAfterS: Math.ceil((windowMs - (now - recent[0])) / 1000) } : { ok: true, retryAfterS: 0 };
    },
    /** Take back the latest hit of a key: a request that turned out not to count (a learn run that ended with Qloo down). */
    release(key: string): void {
      const recent = hits.get(key);
      if (recent?.length) recent.pop();
    },
    /** Record a hit (`weight` hits: a week run counts as several plans) if the key has room for it. */
    check(key: string, now = Date.now(), weight = 1): { ok: boolean; retryAfterS: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length + weight > limit) {
        hits.set(key, recent);
        // The wait until enough of the oldest hits leave the window.
        const freeing = recent[Math.max(0, Math.min(recent.length - 1, recent.length + weight - limit - 1))] ?? now;
        return { ok: false, retryAfterS: Math.max(1, Math.ceil((windowMs - (now - freeing)) / 1000)) };
      }
      for (let i = 0; i < weight; i++) recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) hits.clear(); // bound memory
      return { ok: true, retryAfterS: 0 };
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

/** Fresh agent runs (a new model run; joining or replaying a run doesn't count): 30 per hour per IP. A shared judging network sits behind one IP, so the limit is generous; the cost caps are the daily Qloo budget and the AI Gateway budget. */
export const FRESH_RUNS_PER_HOUR = 30;
export const freshRunLimiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);

export type FreshRunGate = { ok: true } | { ok: false; retryAfterS: number; retryAt: string; message: string };

/** How long the test fault `faults=fresh-limit` says to wait (e2e of the limit page). */
export const FORCED_LIMIT_RETRY_S = 45 * 60;

/**
 * The refusal text. Relative, so it reads right in any time zone (B-013): the response also carries
 * `retryAt` (an ISO instant) for a client that wants to show its own local time.
 */
export function freshLimitMessage(retryAfterS: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterS / 60));
  const limit: number = FRESH_RUNS_PER_HOUR;
  return `You've started ${limit} plan${limit === 1 ? "" : "s"} this hour. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Whether this request may start a fresh agent run. Replays and joined runs (`reused`) are free and never counted;
 * offline test mode spends nothing and isn't limited (the e2e tests share one IP). Per instance, like every limiter
 * here: the Vercel WAF rule on /api/plan (docs/deploy.md) is the cross-instance limit. `forced` (the test fault
 * `faults=fresh-limit`, never in production) refuses whatever the count, so the limit page can be tested offline.
 */
export function freshRunGate(
  {
    reused,
    offline,
    ip,
    forced = false,
  }: {
    reused: boolean;
    offline: boolean;
    ip: string;
    forced?: boolean;
    /** Unused since B-013 (the message is relative); accepted so older callers still compile. */
    timeZone?: string;
  },
  limiter: RateLimiter = freshRunLimiter,
  now = Date.now(),
): FreshRunGate {
  let retryAfterS = FORCED_LIMIT_RETRY_S;
  if (!forced) {
    if (reused || offline) return { ok: true };
    const result = limiter.check(ip, now);
    if (result.ok) return { ok: true };
    retryAfterS = result.retryAfterS;
  }
  return { ok: false, retryAfterS, retryAt: new Date(now + retryAfterS * 1000).toISOString(), message: freshLimitMessage(retryAfterS) };
}
/**
 * A fresh plan run that ended with an uncounted code (PLAN_UNCOUNTED_END_CODES: Qloo down) gives its hit back (B-043).
 * Call it only for a run whose own request was counted by freshRunGate (not a replay, join or offline run).
 */
export function refundPlanRun(code: string | null, ip: string, limiter: RateLimiter = freshRunLimiter): boolean {
  if (code === null || !PLAN_UNCOUNTED_END_CODES.includes(code)) return false;
  limiter.release(ip);
  return true;
}
/** A week run (POST /api/week, one run of the Hive over 7 days) counts as this many fresh plans against FRESH_RUNS_PER_HOUR. */
export const WEEK_RUN_WEIGHT = 4;

/** The week-run refusal text (relative, like the busk limit's). */
export function weekLimitMessage(retryAfterS: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterS / 60));
  return `A week counts as ${WEEK_RUN_WEIGHT} plans, and this hour's plans are used up. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Whether a new week run may start: it takes WEEK_RUN_WEIGHT hits of the fresh-run limit (the busks' own limiter). Offline test
 * mode is exempt (the e2e tests share one IP); `forced` is the test fault `fresh-limit`.
 */
export function weekRunGate({ offline, ip, forced = false }: { offline: boolean; ip: string; forced?: boolean }, limiter: RateLimiter = freshRunLimiter, now = Date.now()): FreshRunGate {
  const result = forced ? { ok: false, retryAfterS: FORCED_LIMIT_RETRY_S } : offline ? { ok: true, retryAfterS: 0 } : limiter.check(ip, now, WEEK_RUN_WEIGHT);
  if (result.ok) return { ok: true };
  return { ok: false, retryAfterS: result.retryAfterS, retryAt: new Date(now + result.retryAfterS * 1000).toISOString(), message: weekLimitMessage(result.retryAfterS) };
}

/** A week run that ended with Qloo down gives its hits back. Only for a run whose own request was counted. */
export function refundWeekRun(ip: string, limiter: RateLimiter = freshRunLimiter): void {
  for (let i = 0; i < WEEK_RUN_WEIGHT; i++) limiter.release(ip);
}

/** Calendar exports of a stored week (GET /api/week/ics): 30 per 10 minutes per IP (no Qloo or model call; a read of stored plans). */
export const weekIcsLimiter = createRateLimiter(30, 10 * 60_000);
/** Plain-LLM comparisons: 12 per 10 minutes per IP (cached, cheap model). */
export const compareLimiter = createRateLimiter(12, 10 * 60_000);
/** Live search (Spotify, Last.fm): 120 per minute per IP; the picker debounces typing. */
export const repertoireLimiter = createRateLimiter(120, 60_000);
/** City search (geocoding, cached): 60 per minute per IP; the picker debounces typing. */
export const citySearchLimiter = createRateLimiter(60, 60_000);
/** Genre search in the research ask (Qloo /v2/tags, cached): 60 per minute per IP; the search debounces typing. */
export const genreSearchLimiter = createRateLimiter(60, 60_000);
/** New short plan links: 30 per 10 minutes per IP (reused links aren't counted). */
export const planLinkLimiter = createRateLimiter(30, 10 * 60_000);

/** New Repertoires: 10 an hour per IP (config.ts:PLAYLIST_CREATIONS_PER_HOUR). Reading or editing an existing one isn't counted. */
export const playlistCreateLimiter = createRateLimiter(PLAYLIST_CREATIONS_PER_HOUR, 60 * 60_000);

/** Whether this request may create a Repertoire. Offline test mode spends nothing and isn't limited (the e2e tests share one IP). */
export function playlistCreateGate(
  { offline, ip }: { offline: boolean; ip: string },
  limiter: RateLimiter = playlistCreateLimiter,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterS: number } {
  if (offline) return { ok: true };
  const result = limiter.check(ip, now);
  return result.ok ? { ok: true } : { ok: false, retryAfterS: result.retryAfterS };
}

/** Learn runs: 6 an hour per IP, per instance like the other limiters (config.ts, confirmed 17 Oct). */
export const learnIpLimiter = createRateLimiter(LEARN_RUNS_PER_HOUR_PER_IP, LEARN_WINDOW_MINUTES * 60_000);

/** A run that ended without counting (LEARN_UNCOUNTED_END_CODES) gives back its network hit; its stored row is already left out of the Repertoire's count. */
export function refundLearnRun(code: string | null, ip: string, limiter: RateLimiter = learnIpLimiter): boolean {
  if (code === null || !LEARN_UNCOUNTED_END_CODES.includes(code)) return false;
  limiter.release(ip);
  return true;
}

export type LearnGate =
  | { ok: true }
  | {
      ok: false;
      scope: LearnLimitScope;
      retryAfterS: number;
      retryAt: string;
      message: string;
      max: number;
      windowMinutes: number;
      retryInMinutes: number;
    };

const minutesOf = (retryAfterS: number) => Math.max(1, Math.ceil(retryAfterS / 60));

/**
 * The refusal text (docs §2.10), relative like the plan limit's (B-013). The network's own message doesn't blame the performer.
 */
export function learnLimitMessage(scope: LearnLimitScope, retryAfterS: number): string {
  return PLAYLIST_COPY.learn.limitMessage(scope, minutesOf(retryAfterS), LEARN_RUNS_PER_HOUR_PER_PLAYLIST);
}

/** Where the Repertoire stands against its own limit, from its stored runs (counted in the database, so every instance agrees). */
export function repertoireLimitState(recent: { count: number; oldestStartedAt: number | null }, now = Date.now()) {
  const max = LEARN_RUNS_PER_HOUR_PER_PLAYLIST;
  const full = recent.count >= max;
  const retryAfterS = full && recent.oldestStartedAt !== null ? Math.max(1, Math.ceil((recent.oldestStartedAt + LEARN_WINDOW_MINUTES * 60_000 - now) / 1000)) : 0;
  return { max, remaining: Math.max(0, max - recent.count), retryAfterS };
}

/**
 * Whether this request may start a learn run. Two limits (docs §2.10): 3 an hour per Repertoire, counted from its stored
 * runs (`recent`), and 6 an hour per IP. When both are hit, `scope` is the one that resets later. Replays and joined runs
 * never come here. Offline test mode spends nothing and isn't limited (the e2e tests share one IP). `forced` (the test
 * faults `learn-limit` and `learn-limit-ip`, never in production) refuses whatever the count. An allowed request records
 * its IP hit; a refused one records nothing.
 */
export function learnRunGate(
  { offline, ip, recent, forced = null }: { offline: boolean; ip: string; recent: { count: number; oldestStartedAt: number | null }; forced?: LearnLimitScope | null },
  limiter: RateLimiter = learnIpLimiter,
  now = Date.now(),
): LearnGate {
  const refuse = (scope: LearnLimitScope, retryAfterS: number): LearnGate => ({
    ok: false,
    scope,
    retryAfterS,
    retryAt: new Date(now + retryAfterS * 1000).toISOString(),
    message: learnLimitMessage(scope, retryAfterS),
    max: scope === "repertoire" ? LEARN_RUNS_PER_HOUR_PER_PLAYLIST : LEARN_RUNS_PER_HOUR_PER_IP,
    windowMinutes: LEARN_WINDOW_MINUTES,
    retryInMinutes: minutesOf(retryAfterS),
  });
  if (forced) return refuse(forced, FORCED_LIMIT_RETRY_S);
  if (offline) return { ok: true };
  const own = repertoireLimitState(recent, now);
  const network = limiter.peek(ip, now);
  if (own.remaining === 0 && !network.ok) return network.retryAfterS > own.retryAfterS ? refuse("ip", network.retryAfterS) : refuse("repertoire", own.retryAfterS);
  if (own.remaining === 0) return refuse("repertoire", own.retryAfterS);
  if (!network.ok) return refuse("ip", network.retryAfterS);
  limiter.check(ip, now);
  return { ok: true };
}
