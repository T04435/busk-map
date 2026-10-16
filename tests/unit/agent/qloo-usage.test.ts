import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * Qloo usage per busk (research totals' qlooCalls and qlooCacheHits), with the Qloo mock and the mock model.
 * 'use cache' is inert outside Next, so the data cache is emulated where it sits in the app: every cached client
 * body (lookupScope) is memoised by its name and arguments, so a hit never runs the body, as 'use cache: remote' does.
 */
const cache = new Map<string, Promise<unknown>>();
vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return {
    ...original,
    lookupScope: <T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> => {
      const key = JSON.stringify([name, args]);
      if (!cache.has(key)) cache.set(key, original.lookupScope(name, args, body).catch((e) => (cache.delete(key), Promise.reject(e))));
      return cache.get(key) as Promise<T>;
    },
  };
});

const request = planRequestSchema.parse({
  city: "melbourne",
  slot: { date: "2026-10-17", startHour: 18, endHour: 21 },
  performer: EXAMPLES[0].performer,
});

async function busk() {
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  const { createMockPlanner } = await import("@/server/agent/mock-model");
  const running: { qlooCalls?: number; qlooCacheHits?: number }[] = [];
  // A new PlanContext each time: a new busk, with only the data cache shared.
  const { plan } = await runPlanAgent(new PlanContext(request, OFFLINE, "2026-10-15"), { onTotals: (t) => running.push(t) }, undefined, { model: createMockPlanner() });
  return { totals: plan.researchTotals!, running };
}

describe("Qloo usage per busk", () => {
  it("a cold run sends Qloo requests; an identical second run is served mostly from the data cache", async () => {
    cache.clear();
    const cold = await busk();
    expect(cold.totals.qlooCalls).toBeGreaterThan(0);
    // The live totals carry the running counts too.
    expect(cold.running.at(-1)!.qlooCalls).toBeGreaterThan(0);
    expect(cold.running.at(-1)!.qlooCalls).toBeLessThanOrEqual(cold.totals.qlooCalls!);

    const warm = await busk();
    expect(warm.totals.qlooCacheHits).toBeGreaterThan(0);
    expect(warm.totals.qlooCalls).toBeLessThan(cold.totals.qlooCalls!);
    // Mostly hits: at least 80% of the warm run's lookups.
    expect(warm.totals.qlooCacheHits! / (warm.totals.qlooCacheHits! + warm.totals.qlooCalls!)).toBeGreaterThanOrEqual(0.8);
  });

  it("concurrent busks: every request is counted once, to the busk that sent it", async () => {
    cache.clear();
    const alone = (await busk()).totals.qlooCalls!;
    cache.clear();
    const [a, b] = await Promise.all([busk(), busk()]);
    expect(a.totals.qlooCalls! + b.totals.qlooCalls!).toBe(alone);
    expect(a.totals.qlooCacheHits! + b.totals.qlooCacheHits!).toBeGreaterThan(0);
  });
});
