import { describe, expect, it, vi } from "vitest";
import { requestFieldsOf } from "@/lib/city";
import { EXAMPLES } from "@/lib/examples";
import { addDays } from "@/lib/slot";
import { defaultDays, weekRequestSchema, weekResultSchema, type WeekRequestInput } from "@/lib/week-schema";
import { mockFetch, OFFLINE } from "../../helpers";

const START = "2026-10-17";
const TODAY = "2026-10-15";
/** Wednesday noon in Melbourne, before the week starts (the e2e clock). */
const NOW = new Date("2026-10-15T12:00:00+11:00");
const TOKYO = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };

function week(days?: WeekRequestInput["days"], extra: Partial<WeekRequestInput> = {}) {
  return weekRequestSchema.parse({
    city: "melbourne",
    performer: EXAMPLES[0].performer,
    startDate: START,
    days: days ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(START, i), startHour: 18, endHour: 21 })),
    ...extra,
  });
}

async function load() {
  vi.resetModules();
  const weekAgent = await import("@/server/agent/week");
  const mock = await import("@/server/agent/mock-model");
  const { QlooUnavailableError } = await import("@/server/agent/agent");
  const runWeekAgent: typeof weekAgent.runWeekAgent = (r, a, t, e, s, o = {}) => weekAgent.runWeekAgent(r, a, t, e, s, { now: NOW, ...o });
  return { ...weekAgent, ...mock, QlooUnavailableError, runWeekAgent };
}

describe("week agent (offline, mock model)", () => {
  it("runs ONE agent loop over the playable days and returns one Hive-picked pitch per day, inside the caps", async () => {
    mockFetch([]);
    const { runWeekAgent, WEEK_LIMITS } = await load();
    const started: { tool: string; input: unknown }[] = [];
    const statuses: string[] = [];
    const days = week().days.map((d, i) => (i === 2 ? { date: d.date, off: true as const } : d));
    const run = await runWeekAgent(week(days), OFFLINE, TODAY, { onToolStart: (e) => started.push(e), onStatus: (m) => statuses.push(m) });

    expect(() => weekResultSchema.parse(run.week)).not.toThrow();
    expect(run.usage.stoppedBy).toBe("finished");
    expect(run.usage.steps).toBeLessThanOrEqual(WEEK_LIMITS.maxSteps);
    expect(run.costUsd).toBeLessThanOrEqual(WEEK_LIMITS.costCapUsd);
    expect(run.qlooCalls).toBeLessThanOrEqual(WEEK_LIMITS.qlooCap);
    expect(started.filter((s) => s.tool !== "finish_week").every((s) => typeof (s.input as { day?: string }).day === "string")).toBe(true);
    expect(started.filter((s) => s.tool === "taste_map")).toHaveLength(1);
    expect(started.findIndex((s) => s.tool === "score_pitches")).toBeGreaterThanOrEqual(3);
    const scoredDays = started.filter((s) => s.tool === "score_pitches").map((s) => (s.input as { day: string }).day);
    expect(new Set(scoredDays).size).toBe(6);
    expect(scoredDays).not.toContain(days[2].date);

    expect(run.week.days.map((d) => d.status)).toEqual(["ready", "ready", "cant-play", "ready", "ready", "ready", "ready"]);
    expect(run.plans).toHaveLength(6);
    for (const day of run.week.days.filter((d) => d.status === "ready")) {
      expect(day.pitch!.why).toMatch(/^Mock explanation/);
      expect(day.window).toBe("6 pm–9 pm");
    }
    expect(run.week).toMatchObject({ status: "done", id: null, error: null, cityName: "Melbourne", rulesChecked: true, timeZone: "Australia/Melbourne" });
    expect(run.week.tasteCells.length).toBeGreaterThan(0);
    expect(run.week.days.filter((d) => d.status === "ready").every((d) => d.weather !== null)).toBe(true);
    for (const { plan } of run.plans) {
      expect(plan.pitches).toHaveLength(1);
      expect(plan.agent).toBeNull();
      expect(plan.explanations).toBe("ai");
      expect(plan.explanationsModel).toBe("mock");
    }
    expect(run.week.researchTotals!.scored).toBeGreaterThan(0);
    expect(run.week.researchTotals!.qlooCalls).toBe(run.qlooCalls);
    expect(statuses).toContain("Planning 6 days");
  });

  it("plans any-time days at the window the Hive's pitch scored best in", async () => {
    mockFetch([]);
    const { runWeekAgent } = await load();
    const days = defaultDays(START).map((d, i) => (i === 1 ? { date: d.date, startHour: 12, endHour: 15 } : d));
    const run = await runWeekAgent(week(days), OFFLINE, TODAY);
    expect(run.week.days.every((d) => d.status === "ready")).toBe(true);
    expect(run.week.days[1]).toMatchObject({ anyTime: false, slot: { startHour: 12, endHour: 15 }, window: "12 pm–3 pm" });
    for (const day of run.week.days.filter((_, i) => i !== 1)) {
      expect(day.anyTime).toBe(true);
      expect(day.slot!.endHour - day.slot!.startHour).toBe(3);
      expect(day.slot!.startHour).toBeGreaterThanOrEqual(10);
      expect(day.slot!.endHour).toBeLessThanOrEqual(22);
    }
    expect(run.plans.filter((p) => p.plan.anyTime)).toHaveLength(6);
    expect(run.plans.every((p) => p.plan.pitches[0].id === run.week.days.find((d) => d.date === p.date)!.pitch!.id)).toBe(true);
  });

  it("plans a week in any city (Tokyo): its time zone, no permit, rules not checked, nothing from Melbourne", async () => {
    mockFetch([]);
    const { runWeekAgent } = await load();
    const run = await runWeekAgent(week(defaultDays(START), { ...requestFieldsOf(TOKYO), permit: "premium" }), OFFLINE, TODAY);
    expect(run.week).toMatchObject({ city: "tokyo-jp", cityName: "Tokyo", timeZone: "Asia/Tokyo", rulesChecked: false, permit: "general" });
    expect(run.week.days.filter((d) => d.status === "ready").length).toBeGreaterThan(0);
    for (const { plan, request } of run.plans) {
      expect(request).toMatchObject({ city: "tokyo-jp", permit: "general" });
      expect(plan.cityName).toBe("Tokyo");
      expect(plan.pitches[0].rules).toMatch(/not checked/);
    }
    expect(JSON.stringify(run.week.days)).not.toMatch(/Federation|Bourke|Flinders/);
    expect(run.qlooCalls).toBeLessThanOrEqual(150);
  });

  it("a week started late in the day: today's passed hours aren't researched (city time)", async () => {
    mockFetch([]);
    const { runWeekAgent, daysPassed, PASSED_REASON, WeekNoDaysLeftError } = await load();
    const late = new Date("2026-10-17T21:30:00+11:00");
    const anyWeek = week(defaultDays(START));
    expect([...daysPassed(anyWeek, late.getTime())]).toEqual([START]);
    const mixed = week(anyWeek.days.map((d, i) => (i === 0 ? { date: d.date, startHour: 19, endHour: 22 } : d)));
    expect(daysPassed(mixed, late.getTime()).size).toBe(0);
    expect(daysPassed(mixed, new Date("2026-10-17T22:00:00+11:00").getTime()).has(START)).toBe(true);

    const started: { tool: string; input: unknown }[] = [];
    const run = await runWeekAgent(anyWeek, OFFLINE, START, { onToolStart: (e) => started.push(e) }, undefined, { now: late });
    expect(run.week.days[0]).toMatchObject({ status: "cant-play", reason: PASSED_REASON });
    expect(run.week.days.slice(1).every((d) => d.status === "ready")).toBe(true);
    expect(started.some((s) => (s.input as { day?: string }).day === START)).toBe(false);
    const lastDay = week(anyWeek.days.map((d, i) => (i === 0 ? d : { date: d.date, off: true as const })));
    await expect(runWeekAgent(lastDay, OFFLINE, START, {}, undefined, { now: late })).rejects.toBeInstanceOf(WeekNoDaysLeftError);
  });

  it("lets the Hive skip a day it finds weak, with its reason", async () => {
    mockFetch([]);
    const { runWeekAgent, createMockWeekPlanner } = await load();
    const run = await runWeekAgent(week(), OFFLINE, TODAY, {}, undefined, { model: createMockWeekPlanner("skip-last") });
    expect(run.week.days.at(-1)).toMatchObject({ status: "not-worth", reason: expect.stringMatching(/weaker day/), pitch: null });
    expect(run.plans).toHaveLength(6);
  });

  it("rejects a pitch outside that day's scored pool, then accepts the fix", async () => {
    mockFetch([]);
    const { runWeekAgent, createMockWeekPlanner } = await load();
    const ended: { tool: string; ok: boolean; summary: string }[] = [];
    const run = await runWeekAgent(week(), OFFLINE, TODAY, { onToolEnd: (e) => ended.push(e) }, undefined, { model: createMockWeekPlanner("bad-finish") });
    const finishes = ended.filter((e) => e.tool === "finish_week");
    expect(finishes[0]).toMatchObject({ ok: false });
    expect(finishes[0].summary).toMatch(/made-up isn't in .* scored pool/);
    expect(finishes.at(-1)).toMatchObject({ ok: true });
    expect(run.week.days.every((d) => d.status === "ready")).toBe(true);
  });

  it("names every picked pitch by a real place when Overpass is down (Tokyo, Qloo venues only): never a taste spot, compass or km", async () => {
    mockFetch([]);
    const { runWeekAgent } = await load();
    const run = await runWeekAgent(week(defaultDays(START), requestFieldsOf({ ...TOKYO, radiusKm: 15 })), { ...OFFLINE, faults: ["osm"] }, TODAY);
    const names = run.week.days.flatMap((d) => (d.pitch ? [d.pitch.name] : []));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).not.toMatch(/taste spot|\b(north|south|east|west)\b|\d km|-?\d+\.\d{3,}/);
    for (const { plan } of run.plans) for (const p of [...plan.pitches, ...plan.others]) expect(p.name).not.toMatch(/taste spot|\d km/);
    expect(run.qlooCalls).toBeLessThanOrEqual(150);
  });

  it("a model that stops with words alone is forced to finish in a final round", async () => {
    mockFetch([]);
    const { runWeekAgent, createMockWeekPlanner } = await load();
    const run = await runWeekAgent(week(), OFFLINE, TODAY, {}, undefined, { model: createMockWeekPlanner("text-only") });
    expect(run.usage.stoppedBy).toBe("finished");
    expect(run.week.days.every((d) => d.status === "ready")).toBe(true);
  });

  it("wraps up at the step cap: scores what's unscored and finishes", async () => {
    mockFetch([]);
    const { runWeekAgent } = await load();
    const started: string[] = [];
    const run = await runWeekAgent(week(), OFFLINE, TODAY, { onToolStart: (e) => started.push(e.tool) }, undefined, { limits: { maxSteps: 5 } });
    expect(run.usage.stoppedBy).toBe("finished");
    expect(started.at(-1)).toBe("finish_week");
    expect(run.week.days.filter((d) => d.status === "ready").length).toBeGreaterThan(0);
  });

  it("wraps up at the cost cap", async () => {
    mockFetch([]);
    const { runWeekAgent } = await load();
    const started: string[] = [];
    // The mock costs US$0.0007 a step: at a US$0.003 cap the run wraps up after three steps and still finishes.
    const run = await runWeekAgent(week(), OFFLINE, TODAY, { onToolStart: (e) => started.push(e.tool) }, undefined, { limits: { costCapUsd: 0.003 } });
    expect(started.at(-1)).toBe("finish_week");
    expect(run.costUsd).toBeLessThan(0.01);
  });

  it("never finishing fails the week: no engine fallback", async () => {
    mockFetch([]);
    const { runWeekAgent, createMockWeekPlanner, WeekPlannerUnavailableError } = await load();
    await expect(runWeekAgent(week(), OFFLINE, TODAY, {}, undefined, { model: createMockWeekPlanner("never-finish"), limits: { maxSteps: 6 } })).rejects.toBeInstanceOf(WeekPlannerUnavailableError);
  });

  it("fails the week when the model fails, and on its own timeout", async () => {
    mockFetch([]);
    const { runWeekAgent, createMockWeekPlanner, WeekPlannerUnavailableError } = await load();
    const error = await runWeekAgent(week(), OFFLINE, TODAY, {}, undefined, { model: createMockWeekPlanner("fail") }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WeekPlannerUnavailableError);
    expect((error as InstanceType<typeof WeekPlannerUnavailableError>).reason).toBe("failed");
    const timedOut = await runWeekAgent(week(), OFFLINE, TODAY, {}, undefined, { limits: { timeoutMs: 1 } }).catch((e: unknown) => e);
    expect(timedOut).toBeInstanceOf(WeekPlannerUnavailableError);
    expect((timedOut as InstanceType<typeof WeekPlannerUnavailableError>).reason).toBe("timeout");
  });

  it("stops before any model call when Qloo is down", async () => {
    mockFetch([]);
    const { runWeekAgent, createMockWeekPlanner, QlooUnavailableError } = await load();
    const model = createMockWeekPlanner();
    const spy = vi.spyOn(model, "doStream");
    await expect(runWeekAgent(week(), { ...OFFLINE, faults: ["qloo"] }, TODAY, {}, undefined, { model })).rejects.toBeInstanceOf(QlooUnavailableError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("stops Qloo looks at the week's Qloo cap", async () => {
    mockFetch([]);
    const { runWeekAgent } = await load();
    const ended: { tool: string; ok: boolean }[] = [];
    const run = await runWeekAgent(week(), OFFLINE, TODAY, { onToolEnd: (e) => ended.push(e) }, undefined, { limits: { qlooCap: 0 } });
    expect(run.usage.stoppedBy).toBe("finished");
    expect(ended.filter((e) => e.tool === "taste_map")).toHaveLength(0);
  });

  it("costs tokens at Sonnet list price", async () => {
    const { costUsd } = await load();
    expect(costUsd(1_000_000, 0)).toBe(2);
    expect(costUsd(0, 100_000)).toBe(1);
  });
});

describe("checkWeekAnswer", () => {
  it("needs every playable day once and at least one pitch when pools exist", async () => {
    vi.resetModules();
    const { checkWeekAnswer } = await import("@/server/agent/week");
    const { AgentState, NumberBag } = await import("@/server/agent/tools");
    const state = new AgentState();
    state.pool.set("p1", { id: "p1", name: "Pitch One", score: 70 } as never);
    const days = new Map([
      ["2026-10-17", { date: "2026-10-17", state } as never],
      ["2026-10-18", { date: "2026-10-18", state: new AgentState() } as never],
    ]);
    const seen = new NumberBag();
    const problems = checkWeekAnswer({ summary: "s", days: [{ day: "2026-10-17", pitchId: null, why: "weak" }, { day: "2026-10-17", pitchId: null, why: "weak" }], notes: [] }, days, seen);
    const text = problems.map((p) => p.message).join(" ");
    expect(text).toMatch(/missing 2026-10-18/);
    expect(text).toMatch(/Each day only once/);
    expect(text).toMatch(/at least one day/);
    const unscored = checkWeekAnswer({ summary: "s", days: [{ day: "2026-10-17", pitchId: "p1", why: "ok" }, { day: "2026-10-18", pitchId: "p1", why: "ok" }], notes: [] }, days, seen);
    expect(unscored.map((p) => p.message)).toEqual(["Call score_pitches for 2026-10-18 before choosing a pitch for it."]);
    const wrong = checkWeekAnswer({ summary: "s", days: [{ day: "2026-10-17", pitchId: "nope", why: "ok" }, { day: "2026-10-18", pitchId: null, why: "weak" }], notes: [] }, days, seen);
    expect(wrong[0].message).toMatch(/nope isn't in 2026-10-17's scored pool. Best scored that day: p1 \(Pitch One\)/);
    // Variety: the same pitch again when an unused one scores within 5 points that day is sent back; a clear best may repeat.
    const a = new AgentState();
    const b = new AgentState();
    for (const st of [a, b]) {
      st.pool.set("p1", { id: "p1", name: "Pitch One", score: 80 } as never);
      st.pool.set("p2", { id: "p2", name: "Pitch Two", score: 77 } as never);
    }
    const two = new Map([
      ["2026-10-17", { date: "2026-10-17", state: a } as never],
      ["2026-10-18", { date: "2026-10-18", state: b } as never],
    ]);
    const same = checkWeekAnswer({ summary: "s", days: [{ day: "2026-10-17", pitchId: "p1", why: "ok" }, { day: "2026-10-18", pitchId: "p1", why: "ok" }], notes: [] }, two, seen);
    expect(same).toEqual([expect.objectContaining({ kind: "variety", message: expect.stringMatching(/2026-10-18 has p2 \(Pitch Two\).*spread the week/) })]);
    b.pool.set("p2", { id: "p2", name: "Pitch Two", score: 70 } as never);
    expect(checkWeekAnswer({ summary: "s", days: [{ day: "2026-10-17", pitchId: "p1", why: "ok" }, { day: "2026-10-18", pitchId: "p1", why: "ok" }], notes: [] }, two, seen)).toEqual([]);
    const invented = checkWeekAnswer({ summary: "About 4321 people.", days: [{ day: "2026-10-17", pitchId: "p1", why: "ok" }, { day: "2026-10-18", pitchId: null, why: "weak" }], notes: [] }, days, seen);
    expect(invented).toEqual([expect.objectContaining({ kind: "numbers", numbers: ["4321"] })]);
  });
});

describe("week request", () => {
  it("takes Melbourne without a place and any other city only with one; seven days in order; one playable", () => {
    expect(weekRequestSchema.safeParse({ performer: EXAMPLES[0].performer, startDate: START, days: defaultDays(START) }).success).toBe(true);
    expect(weekRequestSchema.safeParse({ city: "tokyo-jp", performer: EXAMPLES[0].performer, startDate: START, days: defaultDays(START) }).success).toBe(false);
    expect(weekRequestSchema.safeParse({ ...requestFieldsOf(TOKYO), performer: EXAMPLES[0].performer, startDate: START, days: defaultDays(START) }).success).toBe(true);
    expect(weekRequestSchema.safeParse({ performer: EXAMPLES[0].performer, startDate: START, days: defaultDays("2026-10-18") }).success).toBe(false);
    expect(weekRequestSchema.safeParse({ performer: EXAMPLES[0].performer, startDate: START, days: defaultDays(START).map((d) => ({ date: d.date, off: true })) }).success).toBe(false);
  });
});
