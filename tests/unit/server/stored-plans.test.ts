import { describe, expect, it, vi } from "vitest";
import type { Plan, PlanStreamEvent } from "@/lib/plan-schema";

/** Stored plans and runs keep their full step data and their research totals; replays end on those totals. */
async function load() {
  vi.resetModules();
  const store = await import("@/server/plans/store");
  const plans = await import("@/server/plans");
  const planStore = await import("@/server/agent/plan-store");
  store.resetShortPlanStoresForTests();
  planStore.resetPlanStoresForTests();
  return { ...store, ...plans, ...planStore };
}

const DAY = 24 * 60 * 60_000;
const NOW = Date.parse("2026-10-16T02:00:00Z");

const events: PlanStreamEvent[] = [
  { type: "status", message: "Planning started" },
  { type: "note", kind: "text", text: "Checking the taste map." },
  { type: "tool-start", id: "1", tool: "taste_map", label: "Where the act's taste concentrates", source: "Qloo", input: { radiusM: 400 } },
  { type: "tool-end", id: "1", tool: "taste_map", ok: true, summary: "42 cells; strongest near Federation Square", output: { strongest: [{ near: "Federation Square", affinity: 1 }] } },
  { type: "tool-start", id: "2", tool: "finish_plan", label: "Final answer", input: { summary: "s" } },
  { type: "tool-end", id: "2", tool: "finish_plan", ok: true, summary: "Accepted", output: { accepted: true } },
  { type: "usage", steps: 2, inputTokens: 10, outputTokens: 5, reasoningTokens: 0, ms: 100, stoppedBy: "finished" },
];

describe("stored plans: full step data and research totals", () => {
  it("an old stored plan and run keep every tool output and the plan's research totals", async () => {
    const { MemoryShortPlanStore, MemoryPlanStore, createPlanId, snapshotEvents } = await load();
    const { planRequestSchema } = await import("@/lib/plan-schema");
    const { EXAMPLES } = await import("@/lib/examples");
    const researchTotals = { taste: 51, crowds: 2, places: 3, events: 2, sensors: 2, rules: 24, scored: 22, songs: 3 };
    const plan = { pitches: [], researchTotals } as unknown as Plan;
    const request = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-01", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer });

    const plans = new MemoryShortPlanStore();
    const id = await createPlanId(plans, request, null, "2026-10-01");
    await plans.saveSnapshot(id, { plan, events, explanations: "ai", runKey: "k", runDay: "d", startedAt: NOW - 30 * DAY, finishedAt: NOW - 29 * DAY }, false);
    const stored = (await plans.get(id))!.snapshot!;
    expect(stored.events).toEqual(events);
    expect(stored.plan.researchTotals).toEqual(researchTotals);
    const replay = snapshotEvents(stored).at(-1)!;
    expect(replay.type === "plan" && replay.plan.researchTotals).toEqual(researchTotals);

    const runs = new MemoryPlanStore();
    await runs.put("run", "old", { events: [...events, { type: "plan", plan }], startedAt: 1, finishedAt: 2 }, 30 * DAY, NOW - 8 * DAY);
    const run = (await runs.get<{ events: PlanStreamEvent[] }>("run", "old", NOW))!.value.events;
    expect(run.filter((e) => e.type === "tool-end").every((e) => e.type === "tool-end" && e.output !== undefined)).toBe(true);
    const last = run.at(-1)!;
    expect(last.type === "plan" && last.plan.researchTotals).toEqual(researchTotals);
  });

  it("replays end on the plan's totals: stored totals events are kept, older runs and snapshots get one before the plan", async () => {
    const { snapshotEvents } = await load();
    const { withFinalTotals } = await import("@/server/agent/runs");
    const researchTotals = { taste: 51, crowds: 2, places: 3, events: 2, sensors: 2, rules: 24, scored: 22, songs: 3 };
    const plan = { pitches: [], researchTotals } as unknown as Plan;
    const live: PlanStreamEvent[] = [events[2], events[3], { type: "totals", totals: { ...researchTotals, scored: 0, rules: 0 } }, { type: "totals", totals: researchTotals }];
    // New runs: unchanged, every totals event replayed.
    expect(withFinalTotals([...live, { type: "plan", plan }])).toEqual([...live, { type: "plan", plan }]);
    // Runs stored before totals events existed: one final totals event before the plan.
    const old = withFinalTotals([...events, { type: "plan", plan }]);
    expect(old.slice(-2)).toEqual([{ type: "totals", totals: researchTotals }, { type: "plan", plan }]);
    const snap = { plan, events, explanations: "ai" as const, runKey: "k", runDay: "d", startedAt: 1, finishedAt: 2 };
    expect(snapshotEvents(snap).slice(-2)).toEqual([{ type: "totals", totals: researchTotals }, { type: "plan", plan }]);
    expect(snapshotEvents({ ...snap, events: live }).filter((e) => e.type === "totals")).toHaveLength(2);
    // A plan stored before research totals: nothing invented.
    const bare = { pitches: [] } as unknown as Plan;
    expect(withFinalTotals([...events, { type: "plan", plan: bare }]).some((e) => e.type === "totals")).toBe(false);
  });
});
