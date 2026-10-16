import { describe, expect, it } from "vitest";
import { createRateLimiter, FORCED_LIMIT_RETRY_S, FRESH_RUNS_PER_HOUR, freshLimitMessage, freshRunGate } from "@/server/rate-limit";

// 2026-10-17 10:00 in Melbourne (UTC+11).
const NOW = Date.parse("2026-10-16T23:00:00Z");

describe("fresh agent runs: 5 per hour per IP", () => {
  const live = { reused: false, offline: false, ip: "10.0.0.1" };

  it("allows 5 fresh runs, then refuses with a relative wait, the retry instant and the seconds", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 5; i++) expect(freshRunGate(live, limiter, NOW + i * 60_000)).toEqual({ ok: true });
    const refused = freshRunGate(live, limiter, NOW + 10 * 60_000);
    // The first run leaves the window an hour after it started: 50 minutes from now.
    expect(refused).toEqual({
      ok: false,
      retryAfterS: 50 * 60,
      retryAt: "2026-10-17T00:00:00.000Z",
      message: "You've started 5 plans this hour. Try again in about 50 minutes, or open one of your earlier plans.",
    });
    // Another IP is unaffected; after the hour the first run no longer counts.
    expect(freshRunGate({ ...live, ip: "10.0.0.2" }, limiter, NOW + 10 * 60_000)).toEqual({ ok: true });
    expect(freshRunGate(live, limiter, NOW + 61 * 60_000)).toEqual({ ok: true });
  });

  it("the message names no clock time or zone, whatever the plan city (B-013)", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 5; i++) freshRunGate({ ...live, timeZone: "Australia/Melbourne" }, limiter, NOW);
    const refused = freshRunGate({ ...live, timeZone: "Australia/Melbourne" }, limiter, NOW);
    if (refused.ok) throw new Error("expected the limit");
    expect(refused.message).not.toMatch(/\d:\d\d|am|pm|AEDT|Melbourne|UTC|GMT/i);
    expect(Date.parse(refused.retryAt)).toBe(NOW + refused.retryAfterS * 1000);
  });

  it("replays and joined runs are exempt and never counted", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 20; i++) expect(freshRunGate({ ...live, reused: true }, limiter, NOW)).toEqual({ ok: true });
    // All 5 fresh runs are still available.
    for (let i = 0; i < 5; i++) expect(freshRunGate(live, limiter, NOW).ok).toBe(true);
    expect(freshRunGate(live, limiter, NOW).ok).toBe(false);
    expect(freshRunGate({ ...live, reused: true }, limiter, NOW)).toEqual({ ok: true });
  });

  it("offline test mode spends nothing and isn't limited", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 20; i++) expect(freshRunGate({ ...live, offline: true }, limiter, NOW)).toEqual({ ok: true });
  });

  it("the fresh-limit test fault refuses even offline or for a replay, and counts nothing", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (const extra of [{}, { offline: true }, { reused: true }]) {
      expect(freshRunGate({ ...live, ...extra, forced: true }, limiter, NOW)).toEqual({
        ok: false,
        retryAfterS: FORCED_LIMIT_RETRY_S,
        retryAt: new Date(NOW + FORCED_LIMIT_RETRY_S * 1000).toISOString(),
        message: "You've started 5 plans this hour. Try again in about 45 minutes, or open one of your earlier plans.",
      });
    }
    for (let i = 0; i < 5; i++) expect(freshRunGate(live, limiter, NOW).ok).toBe(true);
  });
});

describe("freshLimitMessage", () => {
  it.each([
    [1, "about 1 minute"],
    [59, "about 1 minute"],
    [60, "about 1 minute"],
    [61, "about 2 minutes"],
    [0, "about 1 minute"],
    [30 * 60, "about 30 minutes"],
    [3600, "about 60 minutes"],
  ])("%i s → %s", (seconds, phrase) => {
    expect(freshLimitMessage(seconds)).toBe(`You've started 5 plans this hour. Try again in ${phrase}, or open one of your earlier plans.`);
  });
});
