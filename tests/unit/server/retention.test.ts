import { describe, expect, it, vi } from "vitest";
import type { Plan, PlanStreamEvent } from "@/lib/plan-schema";

// Route handlers call next/server's connection() (request scope only): a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }));

/**
 * Retention: raw Qloo-derived step data is kept 7 days; plans and links
 * persist. The prune strips each tool-end's output and keeps everything else.
 */
async function load() {
  vi.resetModules();
  const store = await import("@/server/plans/store");
  const plans = await import("@/server/plans");
  const retention = await import("@/server/plans/retention");
  const planStore = await import("@/server/agent/plan-store");
  store.resetShortPlanStoresForTests();
  planStore.resetPlanStoresForTests();
  return { ...store, ...plans, ...retention, ...planStore };
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

describe("retention: strip raw step data after 7 days", () => {
  it("strips only the tool outputs, keeping labels, inputs, summaries and notes; idempotent", async () => {
    const { stripStepOutputs, hasRawStepData, pastRetention, RAW_STEP_RETENTION_MS } = await load();
    expect(RAW_STEP_RETENTION_MS).toBe(7 * DAY);
    const stripped = stripStepOutputs(events);
    expect(hasRawStepData(events)).toBe(true);
    expect(hasRawStepData(stripped)).toBe(false);
    expect(stripped[3]).toEqual({ type: "tool-end", id: "1", tool: "taste_map", ok: true, summary: "42 cells; strongest near Federation Square", pruned: true });
    expect(stripped.filter((e) => e.type !== "tool-end")).toEqual(events.filter((e) => e.type !== "tool-end"));
    expect(stripStepOutputs(stripped)).toEqual(stripped);
    expect(pastRetention(NOW - 7 * DAY, NOW)).toBe(true);
    expect(pastRetention(NOW - 7 * DAY + 1, NOW)).toBe(false);
  });

  it("memory stores: old plans and runs are stripped, recent ones kept, expired runs deleted", async () => {
    const { MemoryShortPlanStore, MemoryPlanStore, createPlanId } = await load();
    const { planRequestSchema } = await import("@/lib/plan-schema");
    const { EXAMPLES } = await import("@/lib/examples");
    const plans = new MemoryShortPlanStore();
    const request = (date: string) => planRequestSchema.parse({ city: "melbourne", slot: { date, startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer });
    const oldId = await createPlanId(plans, request("2026-10-01"), null, "2026-10-01");
    const newId = await createPlanId(plans, request("2026-10-17"), null, "2026-10-16");
    const snap = (finishedAt: number) => ({ plan: { pitches: [] } as unknown as Plan, events, explanations: "ai" as const, runKey: "k", runDay: "d", startedAt: finishedAt - 1, finishedAt });
    await plans.saveSnapshot(oldId, snap(NOW - 8 * DAY), false);
    await plans.saveSnapshot(newId, snap(NOW - DAY), false);
    expect(await plans.pruneRawSteps(NOW - 7 * DAY)).toBe(1);
    expect(await plans.pruneRawSteps(NOW - 7 * DAY)).toBe(0);
    const old = await plans.get(oldId);
    expect(old!.snapshot!.plan).toEqual({ pitches: [] });
    expect(old!.snapshot!.events.filter((e) => e.type === "tool-end").every((e) => e.type === "tool-end" && e.output === undefined && e.pruned)).toBe(true);
    expect((await plans.get(newId))!.snapshot!.events).toEqual(events);

    const runs = new MemoryPlanStore();
    await runs.put("run", "old", { events, startedAt: 1, finishedAt: 2 }, 30 * DAY, NOW - 8 * DAY);
    await runs.put("run", "fresh", { events, startedAt: 1, finishedAt: 2 }, 30 * DAY, NOW - DAY);
    await runs.put("baseline", "gone", { x: 1 }, 1000, NOW - DAY);
    expect(await runs.pruneRawSteps(NOW - 7 * DAY, NOW)).toEqual({ runs: 1, expired: 1 });
    expect(await runs.pruneRawSteps(NOW - 7 * DAY, NOW)).toEqual({ runs: 0, expired: 0 });
    const oldRun = await runs.get<{ events: PlanStreamEvent[] }>("run", "old", NOW);
    expect(oldRun!.value.events.some((e) => e.type === "tool-end" && e.output !== undefined)).toBe(false);
    expect((await runs.get<{ events: PlanStreamEvent[] }>("run", "fresh", NOW))!.value.events).toEqual(events);
  });

  it("Postgres: one idempotent UPDATE per table, on rows past the cutoff that still hold raw output; no DDL", async () => {
    const { PostgresShortPlanStore, PostgresPlanStore } = await load();
    const queries: { text: string; params?: unknown[] }[] = [];
    const sql = { query: vi.fn(async (text: string, params?: unknown[]): Promise<unknown[]> => (queries.push({ text, params }), [{ id: "x" }])) };
    expect(await new PostgresShortPlanStore(sql as never).pruneRawSteps(NOW - 7 * DAY)).toBe(1);
    expect(queries[0].text).toMatch(/^UPDATE plans SET steps = /);
    expect(queries[0].text).toMatch(/e - 'output'/);
    expect(queries[0].text).toMatch(/finished_at < to_timestamp/);
    expect(queries[0].text).toMatch(/jsonb_path_exists\(steps/);
    expect(queries[0].params).toEqual([NOW - 7 * DAY, null]);
    await new PostgresShortPlanStore(sql as never).pruneRawSteps(NOW - 7 * DAY, "AbCdEfGh1");
    expect(queries[1].params).toEqual([NOW - 7 * DAY, "AbCdEfGh1"]);
    expect(await new PostgresPlanStore(sql as never).pruneRawSteps(NOW - 7 * DAY)).toEqual({ runs: 1, expired: 1 });
    expect(queries[2].text).toMatch(/^DELETE FROM plan_store WHERE expires_at <= now\(\)/);
    expect(queries[3].text).toMatch(/^UPDATE plan_store SET value = jsonb_set\(value, '\{events\}'/);
    expect(queries.filter((q) => /CREATE|ALTER|DROP/.test(q.text))).toHaveLength(0);
  });

  it("the plan page strips lazily on read when the run is older than 7 days, and writes it back", async () => {
    const { shortPlanStore, createPlanId, loadStoredPlan } = await load();
    const { planRequestSchema } = await import("@/lib/plan-schema");
    const { EXAMPLES } = await import("@/lib/examples");
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const store = shortPlanStore(true);
    const id = await createPlanId(store, planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[1].performer }), null, "2026-10-16");
    await store.saveSnapshot(id, { plan: { pitches: [] } as unknown as Plan, events, explanations: "ai", runKey: "k", runDay: "d", startedAt: NOW - 9 * DAY, finishedAt: NOW - 8 * DAY }, false);
    const fresh = await loadStoredPlan(id, NOW - 2 * DAY);
    expect(fresh!.snapshot!.events).toEqual(events);
    const read = await loadStoredPlan(id, NOW);
    expect(read!.snapshot!.events.some((e) => e.type === "tool-end" && e.output !== undefined)).toBe(false);
    expect(read!.snapshot!.plan).toEqual({ pitches: [] });
    await vi.waitFor(async () => expect((await store.get(id))!.snapshot!.events.some((e) => e.type === "tool-end" && e.output !== undefined)).toBe(false));
    vi.unstubAllEnvs();
  });

  it("the cron route needs CRON_SECRET as a bearer token, then prunes and reports counts", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("CRON_SECRET", "");
    await load();
    let { GET } = await import("@/app/api/cron/prune/route");
    expect((await GET(new Request("http://x/api/cron/prune"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    vi.resetModules();
    ({ GET } = await import("@/app/api/cron/prune/route"));
    expect((await GET(new Request("http://x/api/cron/prune"))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/prune", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    const ok = await GET(new Request("http://x/api/cron/prune", { headers: { authorization: "Bearer test-secret-value" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ plans: 0, runs: 0, expired: 0, stores: { plans: "memory", runs: "memory" } });
    vi.unstubAllEnvs();
  });
});
