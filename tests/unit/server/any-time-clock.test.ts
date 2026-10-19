import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { nextAnyTimeDate } from "@/lib/slot";
import { OFFLINE } from "../../helpers";

/**
 * The pinned-clock gate for an any-time busk (plan-inputs-architecture.md 2.5): BUSKMAP_FAKE_NOW freezes the server's
 * today and hour, and the default date, the windows scored and "slot passed" all follow it.
 */
const anyOn = (date: string) => planRequestSchema.parse({ city: "melbourne", slot: { date, any: true }, performer: EXAMPLES[0].performer });

async function at(fakeNow: string) {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_FAKE_NOW", fakeNow);
  vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
  const clock = await import("@/server/clock");
  const plans = await import("@/server/plans");
  const { PlanContext } = await import("@/server/agent/context");
  const now = clock.serverLocalNow("Australia/Melbourne");
  return {
    now,
    defaultDate: nextAnyTimeDate(now.today, now.hour),
    passed: (date: string) => plans.slotPassed({ date, any: true }, "Australia/Melbourne"),
    windows: (date: string) => new PlanContext(anyOn(date), OFFLINE).windows().map((w) => w.startHour),
  };
}

describe("any time under the pinned clock", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("Wednesday noon (the DEV default): defaults to today and scores the 7 windows that start after 12", async () => {
    const t = await at("2026-10-14T12:00:00+11:00");
    expect(t.now).toEqual({ today: "2026-10-14", hour: 12 });
    expect(t.defaultDate).toBe("2026-10-14");
    expect(t.windows("2026-10-14")).toEqual([13, 14, 15, 16, 17, 18, 19]);
    expect(t.windows("2026-10-15")).toHaveLength(10);
    expect(t.passed("2026-10-14")).toBe(false);
    expect(t.passed("2026-10-13")).toBe(true);
  });

  it("Friday 21:30 (late evening): defaults to Saturday, scores all 10 windows there, and a stored Friday any-time link has passed", async () => {
    const t = await at("2026-10-16T21:30:00+11:00");
    expect(t.now).toEqual({ today: "2026-10-16", hour: 21 });
    expect(t.defaultDate).toBe("2026-10-17");
    expect(t.windows("2026-10-17")).toHaveLength(10);
    expect(t.windows("2026-10-16")).toEqual([]);
    expect(t.passed("2026-10-16")).toBe(true);
    expect(t.passed("2026-10-17")).toBe(false);
  });

  it("Saturday 00:15 (after midnight): today is Saturday and all 10 windows are open", async () => {
    const t = await at("2026-10-17T00:15:00+11:00");
    expect(t.now).toEqual({ today: "2026-10-17", hour: 0 });
    expect(t.defaultDate).toBe("2026-10-17");
    expect(t.windows("2026-10-17")).toHaveLength(10);
    expect(t.passed("2026-10-17")).toBe(false);
    expect(t.passed("2026-10-16")).toBe(true);
  });

  it("the last window to start is 7 pm: at 18:59 today is open, at 19:00 it has passed", async () => {
    expect((await at("2026-10-16T18:59:00+11:00")).passed("2026-10-16")).toBe(false);
    const t = await at("2026-10-16T19:00:00+11:00");
    expect(t.passed("2026-10-16")).toBe(true);
    expect(t.defaultDate).toBe("2026-10-17");
  });
});
