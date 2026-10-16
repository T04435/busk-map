import { describe, expect, it, vi } from "vitest";
import { createRateLimiter, FORCED_LIMIT_RETRY_S, learnLimitMessage, learnRunGate, repertoireLimitState } from "@/server/rate-limit";

const HOUR = 3_600_000;
const none = { count: 0, oldestStartedAt: null };

describe("learnRunGate (docs §2.10)", () => {
  it("allows the first three runs an hour per Repertoire and refuses the fourth, counted from the stored runs", () => {
    const now = 10 * HOUR;
    const limiter = createRateLimiter(6, HOUR);
    const at = (count: number, oldest: number | null) => learnRunGate({ offline: false, ip: "1.1.1.1", recent: { count, oldestStartedAt: oldest } }, limiter, now);
    expect(at(0, null)).toEqual({ ok: true });
    expect(at(2, now - 50 * 60_000)).toEqual({ ok: true });
    const refused = at(3, now - 20 * 60_000);
    // A second instance sees the same refusal: it reads the same stored runs, not its own memory.
    expect(refused).toMatchObject({ ok: false, scope: "repertoire", max: 3, windowMinutes: 60, retryInMinutes: 40, retryAfterS: 40 * 60 });
    expect(refused.ok === false && refused.message).toBe("You've started 3 runs this hour. Try again in about 40 minutes.");
    expect(refused.ok === false && refused.retryAt).toBe(new Date(now + 40 * 60_000).toISOString());
  });

  it("refuses the seventh run an hour from one network, with words that don't blame the performer", () => {
    const limiter = createRateLimiter(6, HOUR);
    const now = 5 * HOUR;
    for (let i = 0; i < 6; i++) expect(learnRunGate({ offline: false, ip: "9.9.9.9", recent: none }, limiter, now + i * 60_000)).toEqual({ ok: true });
    const refused = learnRunGate({ offline: false, ip: "9.9.9.9", recent: none }, limiter, now + 6 * 60_000);
    expect(refused).toMatchObject({ ok: false, scope: "ip", max: 6, windowMinutes: 60 });
    expect(refused.ok === false && refused.message).toBe("A lot of runs have started from this network in the last hour. Try again in about 54 minutes.");
    expect(refused.ok === false && refused.message).not.toMatch(/you/i);
    // another network is not affected
    expect(learnRunGate({ offline: false, ip: "8.8.8.8", recent: none }, limiter, now)).toEqual({ ok: true });
  });

  it("when both limits are hit, the scope is the one that resets later; a refused request records no IP hit", () => {
    const now = 3 * HOUR;
    const limiter = createRateLimiter(1, HOUR);
    limiter.check("ip", now - 30 * 60_000); // network resets in 30 min
    const own = { count: 3, oldestStartedAt: now - 5 * 60_000 }; // Repertoire resets in 55 min
    expect(learnRunGate({ offline: false, ip: "ip", recent: own }, limiter, now)).toMatchObject({ scope: "repertoire", retryInMinutes: 55 });
    const ownSoon = { count: 3, oldestStartedAt: now - 55 * 60_000 }; // 5 min
    expect(learnRunGate({ offline: false, ip: "ip", recent: ownSoon }, limiter, now)).toMatchObject({ scope: "ip", retryInMinutes: 30 });
    // Repertoire limit hit, network fine: only the Repertoire is told, and the IP counter did not move.
    const fresh = createRateLimiter(1, HOUR);
    expect(learnRunGate({ offline: false, ip: "x", recent: own }, fresh, now)).toMatchObject({ scope: "repertoire" });
    expect(fresh.peek("x", now).ok).toBe(true);
  });

  it("replays and offline runs are free: offline never counts, whatever the stored runs say", () => {
    const limiter = createRateLimiter(1, HOUR);
    for (let i = 0; i < 10; i++) expect(learnRunGate({ offline: true, ip: "same", recent: { count: 9, oldestStartedAt: 1 } }, limiter)).toEqual({ ok: true });
    expect(limiter.peek("same").ok).toBe(true);
  });

  it("a forced fault refuses with either scope and the fixed wait, even offline", () => {
    for (const scope of ["repertoire", "ip"] as const) {
      const gate = learnRunGate({ offline: true, ip: "x", recent: none, forced: scope }, undefined, 0);
      expect(gate).toMatchObject({ ok: false, scope, retryAfterS: FORCED_LIMIT_RETRY_S, retryInMinutes: 45, retryAt: new Date(FORCED_LIMIT_RETRY_S * 1000).toISOString() });
    }
  });

  it("messages stay relative and singular at one minute", () => {
    expect(learnLimitMessage("repertoire", 30)).toBe("You've started 3 runs this hour. Try again in about 1 minute.");
    expect(learnLimitMessage("ip", 120)).toMatch(/about 2 minutes\.$/);
    expect(learnLimitMessage("ip", 120)).not.toMatch(/\d:\d\d|\b(am|pm)\b/i);
  });

  it("the Repertoire's state: remaining runs and when the oldest leaves the window", () => {
    vi.useFakeTimers();
    expect(repertoireLimitState(none)).toEqual({ max: 3, remaining: 3, retryAfterS: 0 });
    expect(repertoireLimitState({ count: 3, oldestStartedAt: 0 }, 30 * 60_000)).toEqual({ max: 3, remaining: 0, retryAfterS: 30 * 60 });
    vi.useRealTimers();
  });
});
