/**
 * QA: the fresh-run limit (e83a94c) without spending money. The route skips the gate offline, so an offline e2e can't
 * reach it; this calls the gate itself with offline: false and a private limiter.
 */
import { describe, expect, it } from "vitest";
import { createRateLimiter, FRESH_RUNS_PER_HOUR, freshRunGate } from "@/server/rate-limit";

const IP = "203.0.113.7";
const NOW = Date.UTC(2026, 10, 3, 4, 0, 0); // 3 Nov 2026 04:00 UTC = 3 pm in Melbourne
const live = (reused: boolean, limiter: ReturnType<typeof createRateLimiter>, now = NOW) =>
  freshRunGate({ reused, offline: false, ip: IP, timeZone: "Australia/Melbourne" }, limiter, now);

describe("QA fresh-run gate", () => {
  it("allows 5 fresh runs an hour, and the 6th gets the message with a retry time", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    expect(FRESH_RUNS_PER_HOUR).toBe(5);
    for (let i = 0; i < 5; i++) expect(live(false, limiter, NOW + i * 1000).ok).toBe(true);
    const sixth = live(false, limiter, NOW + 6000);
    expect(sixth.ok).toBe(false);
    if (sixth.ok) return;
    expect(sixth.retryAfterS).toBeGreaterThan(0);
    expect(sixth.retryAfterS).toBeLessThanOrEqual(3600);
    expect(sixth.message).toMatch(/^You've started 5 plans this hour\. Try again in about \d+ minutes?, or open one of your earlier plans\.$/);
  });

  it("replays and joined runs never count, before or after the limit", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 20; i++) expect(live(true, limiter, NOW + i).ok).toBe(true);
    for (let i = 0; i < 5; i++) expect(live(false, limiter, NOW + 100 + i).ok).toBe(true);
    expect(live(false, limiter, NOW + 200).ok).toBe(false);
    expect(live(true, limiter, NOW + 300).ok).toBe(true); // a replay still opens at the limit
  });

  it("another IP has its own allowance; the window resets after an hour", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 5; i++) live(false, limiter, NOW + i);
    expect(live(false, limiter, NOW + 10).ok).toBe(false);
    expect(freshRunGate({ reused: false, offline: false, ip: "198.51.100.1", timeZone: "Australia/Melbourne" }, limiter, NOW + 10).ok).toBe(true);
    expect(live(false, limiter, NOW + 60 * 60_000 + 10).ok).toBe(true);
  });

  it("offline mode is never limited", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 10; i++) expect(freshRunGate({ reused: false, offline: true, ip: IP, timeZone: "Australia/Melbourne" }, limiter, NOW).ok).toBe(true);
  });

  it("B-013 (fixed): the retry hint is relative, so it reads the same in every time zone", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    for (let i = 0; i < 5; i++) live(false, limiter, NOW);
    const melbourne = live(false, limiter, NOW);
    const newYork = freshRunGate({ reused: false, offline: false, ip: IP, timeZone: "America/New_York" }, limiter, NOW);
    if (melbourne.ok || newYork.ok) throw new Error("expected the limit");
    expect(melbourne.message).toMatch(/Try again in about 60 minutes/);
    expect(newYork.message).toBe(melbourne.message);
    expect(melbourne.message).not.toMatch(/\d:\d\d|am\b|pm\b|AEDT|UTC/i);
  });
});
