import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * Suggested fill: Qloo usage per busk (research totals' qlooCalls and qlooCacheHits), with the Qloo mock and the mock model.
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
const filled = planRequestSchema.parse({ ...request, performer: { ...request.performer, fillSuggested: 4 } });

async function busk(req: typeof request) {
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  const { createMockPlanner } = await import("@/server/agent/mock-model");
  const { plan } = await runPlanAgent(new PlanContext(req, OFFLINE, "2026-10-15"), {}, undefined, { model: createMockPlanner() });
  return plan;
}

describe("Suggested fill: Qloo accounting (docs/plan-inputs-architecture.md §3.1, §3.2)", () => {
  it("costs exactly one extra Qloo call on a cold busk (the related-artists read), none on a warm one", async () => {
    cache.clear();
    const plain = (await busk(request)).researchTotals!.qlooCalls!;
    cache.clear();
    const fill = await busk(filled);
    expect(fill.researchTotals!.qlooCalls).toBe(plain + 1);
    // The same busk again: every lookup comes from the data cache.
    const warm = await busk(filled);
    expect(warm.researchTotals!.qlooCalls).toBe(0);
    expect(warm.researchTotals!.qlooCacheHits).toBeGreaterThan(0);
  });

  it("puts suggested songs in the plan, counted in researchTotals.songs, and parses back through the plan schema", async () => {
    cache.clear();
    const plan = await busk(filled);
    const suggested = plan.pitches.flatMap((p) => p.setlist.filter((s) => s.origin === "suggested"));
    expect(suggested.length).toBeGreaterThan(0);
    // build_setlist shows the model (and the totals) the first 10 songs of a set.
    expect(plan.researchTotals!.songs).toBeGreaterThanOrEqual(Math.min(10, new Set(plan.pitches[0].setlist.map((s) => s.title)).size));
    const { planSchema } = await import("@/lib/plan-schema");
    expect(planSchema.parse(JSON.parse(JSON.stringify(plan))).pitches[0].setlist).toEqual(plan.pitches[0].setlist);
  });

  it("is not a learn run: no learn run limit is touched", async () => {
    cache.clear();
    const plan = await busk(filled);
    expect(plan.researchTotals).not.toHaveProperty("newSongs");
  });
});
