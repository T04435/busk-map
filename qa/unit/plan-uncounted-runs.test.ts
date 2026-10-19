// QA (B-043 logic, dev/core c845cd7): a fresh plan run that ends with Qloo down gives its hit back; other endings keep it;
// replays, joins and offline runs record nothing. Independent of DEV's tests: the real gate, limiter and refund.
import { describe, expect, it } from "vitest";
import { PLAN_UNCOUNTED_END_CODES } from "@/server/playlist/config";
import { createRateLimiter, FRESH_RUNS_PER_HOUR, freshRunGate, refundPlanRun } from "@/server/rate-limit";

const HOUR = 3_600_000;
const IP = "198.51.100.9";
const t0 = 50 * HOUR;
const fresh = (limiter: ReturnType<typeof createRateLimiter>, now: number, extra: { reused?: boolean; offline?: boolean } = {}) =>
  freshRunGate({ reused: false, offline: false, ip: IP, ...extra }, limiter, now);

describe("QA B-043: uncounted plan runs", () => {
  it("only qloo_unavailable is uncounted, and the limit is 5 an hour", () => {
    expect(PLAN_UNCOUNTED_END_CODES).toEqual(["qloo_unavailable"]);
    expect(FRESH_RUNS_PER_HOUR).toBe(5);
  });

  it("five Qloo-down runs leave the count where it was; five real runs still fit, the sixth is refused", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, HOUR);
    for (let i = 0; i < 5; i++) {
      expect(fresh(limiter, t0 + i * 60_000), `Qloo-down run ${i + 1}`).toEqual({ ok: true });
      expect(refundPlanRun("qloo_unavailable", IP, limiter)).toBe(true);
    }
    expect(limiter.peek(IP, t0 + 6 * 60_000).ok).toBe(true);
    for (let i = 0; i < 5; i++) expect(fresh(limiter, t0 + (10 + i) * 60_000), `real run ${i + 1}`).toEqual({ ok: true });
    expect(fresh(limiter, t0 + 20 * 60_000)).toMatchObject({ ok: false });
  });

  it("a normal end, a timeout (the engine's plan) and an internal error keep their hit", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, HOUR);
    const ends = [null, "timeout", "internal", "model_unavailable", "stopped"];
    for (const [i, code] of ends.entries()) {
      expect(fresh(limiter, t0 + i * 60_000)).toEqual({ ok: true });
      expect(refundPlanRun(code, IP, limiter), String(code)).toBe(false);
    }
    expect(fresh(limiter, t0 + 10 * 60_000)).toMatchObject({ ok: false });
  });

  it("replays, joins and offline runs record nothing, so there is nothing to give back", () => {
    const limiter = createRateLimiter(1, HOUR);
    for (let i = 0; i < 10; i++) {
      expect(fresh(limiter, t0 + i * 1000, { reused: true })).toEqual({ ok: true });
      expect(fresh(limiter, t0 + i * 1000, { offline: true })).toEqual({ ok: true });
    }
    expect(limiter.peek(IP, t0 + 20_000).ok).toBe(true);
    // The route only refunds a counted run (counted = !reused && !offline); an extra release on an empty key is harmless.
    limiter.release("never-seen");
    expect(fresh(limiter, t0 + 30_000)).toEqual({ ok: true });
    expect(fresh(limiter, t0 + 31_000)).toMatchObject({ ok: false });
  });
});
