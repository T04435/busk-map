import { describe, expect, it } from "vitest";
import { createRateLimiter, FRESH_RUNS_PER_HOUR, freshRunGate } from "@/server/rate-limit";

const MELBOURNE = "Australia/Melbourne";
// 2026-10-17 10:00 in Melbourne (UTC+11).
const NOW = Date.parse("2026-10-16T23:00:00Z");

describe("fresh agent runs: 5 per hour per IP", () => {
  const live = { reused: false, offline: false, ip: "10.0.0.1", timeZone: MELBOURNE };

  it("allows 5 fresh runs, then refuses with a friendly message and the time to try again", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 5; i++) expect(freshRunGate(live, limiter, NOW + i * 60_000)).toEqual({ ok: true });
    const refused = freshRunGate(live, limiter, NOW + 10 * 60_000);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    // The first run leaves the window an hour after it started: 11:00 am.
    expect(refused.retryAfterS).toBe(50 * 60);
    expect(refused.message).toBe("You've started 5 plans this hour. Open one of your earlier plans, or try again at 11:00 am.");
    // Another IP is unaffected; after the hour the first run no longer counts.
    expect(freshRunGate({ ...live, ip: "10.0.0.2" }, limiter, NOW + 10 * 60_000)).toEqual({ ok: true });
    expect(freshRunGate(live, limiter, NOW + 61 * 60_000)).toEqual({ ok: true });
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
});
