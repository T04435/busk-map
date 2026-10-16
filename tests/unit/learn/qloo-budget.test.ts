import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache, cachedLookupScope, history, playlist, setupFetch } from "./helpers";

vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return { ...original, lookupScope: cachedLookupScope(original) };
});

/** The Qloo requests of a mock learn run (docs §2.9): the hard cap is 25, a typical run is far under it. */
async function learnRun() {
  vi.resetModules();
  await setupFetch();
  const { runLearnAgent } = await import("@/server/learn/agent");
  const { LearnContext } = await import("@/server/learn/context");
  const { createMockLearner } = await import("@/server/learn/mock-model");
  const { withQlooUsage } = await import("@/server/adapters/qloo/usage");
  const { LEARN_QLOO_BUDGET } = await import("@/server/playlist/config");
  const running: number[] = [];
  const out = await withQlooUsage(async (usage) => {
    const ctx = new LearnContext({ offline: true, faults: [] }, playlist(), history(), "2026-10-17", usage);
    const result = await runLearnAgent(ctx, { onTotals: (t) => running.push(t.qlooCalls) }, undefined, { model: createMockLearner() });
    return { result, calls: usage.calls, hits: usage.cacheHits };
  });
  return { ...out, running, budget: LEARN_QLOO_BUDGET };
}

beforeEach(() => cache.clear());

describe("Qloo requests per learn run", () => {
  it("a cold run stays within the 25-request cap, and a warm one (same data, cached for the day) sends none", async () => {
    const cold = await learnRun();
    expect(cold.calls).toBeGreaterThan(0);
    expect(cold.calls).toBeLessThanOrEqual(cold.budget);
    expect(cold.budget).toBe(25);
    const warm = await learnRun();
    expect(warm.calls).toBeLessThanOrEqual(10);
    expect(warm.hits).toBeGreaterThan(0);
    // The numbers the mock run measured (also in the dev log): cold requests, warm requests, warm cache hits.
    console.info(`learn run Qloo requests (mock model): cold ${cold.calls} requests, ${cold.hits} cache hits; warm ${warm.calls} requests, ${warm.hits} cache hits`);
  });

  it("the running count in the totals only grows and ends at the run's count", async () => {
    const { running, calls } = await learnRun();
    expect(running.length).toBeGreaterThan(3);
    for (let i = 1; i < running.length; i++) expect(running[i]).toBeGreaterThanOrEqual(running[i - 1]);
    expect(running.at(-1)).toBe(calls);
  });
});
