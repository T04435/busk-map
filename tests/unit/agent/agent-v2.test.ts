import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { planRequestSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * Agent v2 guardrails (mock model, Qloo mock; no network): bounded inputs,
 * the scored pool, the final-answer checks, and the step, token and time caps.
 */
const request = planRequestSchema.parse({
  city: "melbourne",
  slot: { date: "2026-10-17", startHour: 18, endHour: 21 },
  performer: EXAMPLES[0].performer,
});

async function load() {
  vi.resetModules();
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const agent = await import("@/server/agent/agent");
  const tools = await import("@/server/agent/tools");
  const mock = await import("@/server/agent/mock-model");
  const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
  return { ctx, ...agent, ...tools, ...mock };
}

type Exec = (input: unknown, options: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown }, input: unknown) => (t.execute as Exec)(input, { toolCallId: "t", messages: [] });

describe("Agent v2 tools", () => {
  it("reject points outside the planning area and unknown pitch ids, with a message the model can act on", async () => {
    const { ctx, createTools, AgentState } = await load();
    const tools = createTools(ctx, new AgentState());
    await expect(run(tools.crowd_at, { at: { lat: -33.86, lon: 151.21 } })).rejects.toThrow(/outside the planning area/);
    await expect(run(tools.footfall_at, { at: { pitchId: "nowhere" } })).rejects.toThrow(/Unknown pitchId/);
    await expect(run(tools.busy_places, { near: { place: "Sydney Opera House" } })).rejects.toThrow(/doesn't know a place/);
    await expect(run(tools.taste_map, { signals: ["Nobody Real"] })).rejects.toThrow(/not a matched artist|None of/);
  });

  it("snap radii to the allowed steps and label points by the nearest known place", async () => {
    const { ctx, createTools, AgentState } = await load();
    const tools = createTools(ctx, new AgentState());
    const out = (await run(tools.crowd_at, { at: { place: "Federation Square" }, radiusM: 333 })) as { radiusM: number; at: { label: string } };
    expect(out.radiusM).toBe(400);
    expect(out.at.label).toBe("Federation Square");
  });

  it("let the agent add a checked spot that the engine then scores; only scored pitches can be final", async () => {
    const { ctx, createTools, AgentState, checkAnswer } = await load();
    const state = new AgentState();
    const tools = createTools(ctx, state);
    const ranked = await ctx.ranked();
    // A point inside the area, away from every engine candidate.
    const spot = { lat: -37.8075, lon: 144.9405 };
    expect(ranked.every((p) => Math.hypot(p.lat - spot.lat, p.lon - spot.lon) > 0.0008)).toBe(true);
    const checked = (await run(tools.check_pitch, { spot })) as { pitchId: string | null; legal: string; inPool: boolean };
    expect(checked.legal).toBe("not ruled out");
    expect(checked.inPool).toBe(false);
    // score_pitches is closed until three looks are in, one of them about the crowd.
    await expect(run(tools.score_pitches, {})).rejects.toThrow(/isn't open yet.*2 more looks.*taste_map, crowd_at or events_near/);
    await run(tools.footfall_at, { at: spot });
    await run(tools.busy_places, { near: spot });
    await expect(run(tools.score_pitches, {})).rejects.toThrow(/Still needed: at least one of taste_map, crowd_at or events_near/);
    await run(tools.taste_map, {});
    expect(state.looks).toEqual(["check_pitch", "footfall_at", "busy_places", "taste_map"]);
    await expect(run(tools.score_pitches, { add: ["agent:never-checked"] })).rejects.toThrow(/check_pitch first/);
    const scored = (await run(tools.score_pitches, { add: [checked.pitchId] })) as { pitches: { pitchId: string }[]; added: string[]; poolSize: number };
    expect(scored.added).toEqual([checked.pitchId]);
    expect(scored.poolSize).toBe(ranked.length + 1);
    expect(state.pool.get(checked.pitchId!)!.origin).toBe("agent");

    const engineTop = await ctx.topPitches();
    const answer = (ids: string[]) => ({ summary: "s", pitches: ids.map((pitchId) => ({ pitchId, why: "w" })), notes: [] });
    expect(checkAnswer(answer([checked.pitchId!, engineTop[0].id, engineTop[1].id]), state)).toEqual([]);
    expect(checkAnswer(answer(["made-up", engineTop[0].id, engineTop[1].id]), state).map((p) => p.kind)).toContain("pool");
    expect(checkAnswer(answer([engineTop[0].id]), state).map((p) => p.kind)).toContain("count");
    expect(checkAnswer(answer([engineTop[0].id, engineTop[0].id, engineTop[1].id]), state).map((p) => p.kind)).toContain("count");
    const near = [...state.pool.values()].find((p) => p.id !== engineTop[0].id && Math.hypot(p.lat - engineTop[0].lat, p.lon - engineTop[0].lon) < 0.001);
    if (near) expect(checkAnswer(answer([engineTop[0].id, near.id, engineTop[2].id]), state).map((p) => p.kind)).toContain("spacing");
  });

  it("with the council's layers down, no spot can be checked or added", async () => {
    vi.resetModules();
    mockFetch([]);
    const { PlanContext } = await import("@/server/agent/context");
    const { createTools, AgentState } = await import("@/server/agent/tools");
    const ctx = new PlanContext(request, { offline: true, faults: ["pitches"] }, "2026-10-15");
    const state = new AgentState();
    const tools = createTools(ctx, state);
    const out = (await run(tools.check_pitch, { spot: { place: "Federation Square" } })) as { legal: string; pitchId: string | null };
    expect(out).toMatchObject({ legal: "unknown", pitchId: null });
    expect(state.checked.size).toBe(0);
  });

  it("flag each pitch within 250 m of a better kept one, as the engine spaces its picks", async () => {
    const { sameCorners } = await load();
    const p = (id: string, lat: number) => ({ id, name: id, lat, lon: 144.96 }) as never;
    // a; b is 111 m from a; c is 222 m from a (but kept b doesn't count: b was dropped); d is 333 m away.
    const corners = sameCorners([p("a", -37.81), p("b", -37.811), p("c", -37.812), p("d", -37.813)]);
    expect(Object.fromEntries(corners)).toEqual({ b: "a", c: "a" });
  });

  it("finish_plan is refused before anything is scored", async () => {
    const { ctx, createTools, AgentState } = await load();
    const state = new AgentState();
    const tools = createTools(ctx, state);
    const out = (await run(tools.finish_plan, { summary: "s", pitches: [{ pitchId: "x", why: "y" }], notes: [] })) as { accepted: boolean; summary: string };
    expect(out.accepted).toBe(false);
    expect(out.summary).toMatch(/score_pitches/);
    expect(state.answer).toBeNull();
  });

  it("the numbers check accepts numbers the tools returned (rounded, or 0–1 written out of 100) and flags invented ones", async () => {
    const { NumberBag } = await load();
    const bag = new NumberBag();
    bag.add({ peoplePerHour: 1893, affinity: 0.71, starts: "19:30", score: 74 });
    expect(bag.unknownIn("About 1,900 people an hour, a 71/100 match, the crowd leaves at 7:30 and it scored 74.")).toEqual([]);
    expect(bag.unknownIn("About 54,321 people pass and 88% like it.")).toEqual(["54321", "88"]);
  });
});

describe("Agent v2 runs (mock model)", () => {
  it("a rejected final answer is shown as a step, fixed, and accepted", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const ends: { tool: string; ok: boolean; summary: string }[] = [];
    const { plan } = await runPlanAgent(ctx, { onToolEnd: (e) => ends.push(e) }, undefined, { model: createMockPlanner("bad-finish") });
    const finishes = ends.filter((e) => e.tool === "finish_plan");
    expect(finishes.map((e) => e.ok)).toEqual([false, true]);
    expect(finishes[0].summary).toMatch(/Not in the scored pool: made-up/);
    expect(plan.explanations).toBe("ai");
    // A model passed in counts as Claude's (production passes none).
    expect(plan.explanationsModel).toBe("claude");
    expect(plan.pitches.map((p) => p.id)).not.toContain("made-up");
  });

  it("offline, the plan says the mock model wrote the explanations (B-007)", async () => {
    const { ctx, runPlanAgent } = await load();
    const { plan } = await runPlanAgent(ctx);
    expect(plan.explanations).toBe("ai");
    expect(plan.explanationsModel).toBe("mock");
  });

  it("score_pitches isn't offered, and errors, until three looks are in, one of them about the crowd", async () => {
    const { ctx, runPlanAgent, createMockPlanner, gateMessage, scoringOpen } = await load();
    const offered: string[][] = [];
    const base = createMockPlanner("lazy");
    const spy = new MockLanguageModelV4({
      doStream: async (options) => {
        offered.push((options.tools ?? []).map((t) => t.name));
        return base.doStream(options);
      },
    });
    const started: string[] = [];
    const { plan } = await runPlanAgent(ctx, { onToolStart: (e) => started.push(e.tool) }, undefined, { model: spy });
    // The lazy mock scores as soon as it can: after footfall_at, busy_places, check_pitch (no crowd look yet) and crowd_at.
    expect(started.slice(0, 5)).toEqual(["footfall_at", "busy_places", "check_pitch", "crowd_at", "score_pitches"]);
    for (const tools of offered.slice(0, 4)) {
      expect(tools).not.toContain("score_pitches");
      expect(tools).not.toContain("finish_plan");
    }
    expect(offered[4]).toContain("score_pitches");
    expect(plan.explanations).toBe("ai");
    expect(scoringOpen({ looks: ["footfall_at", "busy_places", "check_pitch"], wrappingUp: false })).toBe(false);
    expect(scoringOpen({ looks: ["events_near", "footfall_at", "footfall_at"], wrappingUp: false })).toBe(true);
    expect(scoringOpen({ looks: [], wrappingUp: true })).toBe(true);
    expect(gateMessage({ looks: ["taste_map"] })).toMatch(/2 more looks/);
  });

  it("a cap that forces the end before any scoring still finishes against a scored pool", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const started: string[] = [];
    // Two steps of looks, then the cap: score_pitches is opened for the wrap-up, then finish_plan.
    const { plan, usage } = await runPlanAgent(ctx, { onToolStart: (e) => started.push(e.tool) }, undefined, { model: createMockPlanner(), limits: { maxSteps: 4 } });
    expect(started).toEqual(["taste_map", "crowd_at", "footfall_at", "score_pitches", "finish_plan"]);
    expect(usage!.stoppedBy).toBe("finished");
    expect(plan.explanations).toBe("ai");
  });

  it("re-ranking against the engine is shown position by position, with the reason from the pick's why", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const { plan, engineTop, agentTop } = await runPlanAgent(ctx, {}, undefined, { model: createMockPlanner("rerank") });
    expect(plan.explanations).toBe("ai");
    expect(agentTop!.map((p) => p.id)).toEqual([engineTop[1].id, engineTop[0].id, engineTop[2].id]);
    expect(plan.agent!.differs).toBe(true);
    expect(plan.agent!.changes).toEqual([
      expect.objectContaining({ position: 1, pick: expect.objectContaining({ id: engineTop[1].id, engineRank: 2 }), over: expect.objectContaining({ id: engineTop[0].id, engineRank: 1 }), reason: expect.stringMatching(/^The crowd at .+ fits this act better on the data gathered\.$/) }),
      expect.objectContaining({ position: 2, pick: expect.objectContaining({ id: engineTop[0].id, engineRank: 1 }), over: expect.objectContaining({ id: engineTop[1].id, engineRank: 2 }) }),
    ]);
  });

  it("stops at the step cap and shows the engine's plan with a note", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const { plan, usage, agentTop } = await runPlanAgent(ctx, {}, undefined, { model: createMockPlanner("never-finish"), limits: { maxSteps: 5 } });
    expect(usage!.steps).toBeLessThanOrEqual(5);
    expect(usage!.stoppedBy).not.toBe("finished");
    expect(agentTop).toBeNull();
    expect(plan.explanations).toBe("template");
    expect(plan.agent).toBeNull();
    expect(plan.notes.join(" ")).toMatch(/engine's plan/);
    expect(plan.pitches.map((p) => p.id)).toEqual((await ctx.topPitches()).map((p) => p.id));
  });

  it("near the token budget the run wraps up (scoring first if needed), so it ends early with an answer", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const started: string[] = [];
    // The mock spends 150 tokens a step: unscored, the run wraps up at 60% (after two steps), scores, then finishes.
    const { usage, plan } = await runPlanAgent(ctx, { onToolStart: (e) => started.push(e.tool) }, undefined, { model: createMockPlanner(), limits: { tokenBudget: 500 } });
    expect(started).toEqual(["taste_map", "crowd_at", "footfall_at", "score_pitches", "finish_plan"]);
    expect(started.at(-1)).toBe("finish_plan");
    expect(started).not.toContain("compare_crowds");
    expect(usage!.stoppedBy).toBe("finished");
    expect(plan.explanations).toBe("ai");
  });

  it("times out at the limit and shows the engine's plan with a note", async () => {
    const { ctx, runPlanAgent } = await load();
    const hanging = new MockLanguageModelV4({
      doStream: (options) =>
        new Promise((_, reject) => options.abortSignal?.addEventListener("abort", () => reject(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })))),
    });
    const { plan, usage } = await runPlanAgent(ctx, {}, undefined, { model: hanging, limits: { timeoutMs: 50 } });
    expect(usage).toBeNull();
    expect(plan.explanations).toBe("template");
    expect(plan.notes.join(" ")).toMatch(/ran out of time/);
  });

  it("a model failure falls back to the engine's plan", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const { plan } = await runPlanAgent(ctx, {}, undefined, { model: createMockPlanner("fail") });
    expect(plan.explanations).toBe("template");
    expect(plan.notes.join(" ")).toMatch(/unavailable/);
  });

  it("invented numbers are rejected; if they persist, Claude's choice stands but its words are replaced", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const ends: { tool: string; ok: boolean }[] = [];
    const { plan } = await runPlanAgent(ctx, { onToolEnd: (e) => ends.push(e) }, undefined, { model: createMockPlanner("invented-numbers") });
    expect(ends.filter((e) => e.tool === "finish_plan").map((e) => e.ok)).toEqual([false, false, true]);
    expect(plan.pitches.every((p) => !p.why.includes("98765"))).toBe(true);
    expect(plan.pitches.every((p) => p.whySource === "template")).toBe(true);
  });

  it("research totals: an agent plan counts its tool outputs at finish; an engine-only plan counts the engine's data", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const { fromToolOutputs, fromEngine } = await import("@/lib/research-totals");
    const ends: { tool: string; ok: boolean; output: unknown }[] = [];
    const { plan } = await runPlanAgent(ctx, { onToolEnd: (e) => ends.push(e) }, undefined, { model: createMockPlanner() });
    expect(plan.explanations).toBe("ai");
    // The data totals come from the tool outputs; the Qloo usage fields from the run's counter.
    const { qlooCalls, qlooCacheHits, ...data } = plan.researchTotals!;
    expect(data).toEqual(fromToolOutputs(ends));
    expect(qlooCalls).toBeGreaterThan(0);
    expect(qlooCacheHits).toBeGreaterThanOrEqual(0);
    const scoring = ends.filter((e) => e.tool === "score_pitches").at(-1)!.output as { poolSize: number };
    expect(plan.researchTotals!.scored).toBe(scoring.poolSize);
    expect(plan.researchTotals!.scored).toBeGreaterThan(0);
    expect(plan.researchTotals!.rules).toBeGreaterThanOrEqual(plan.researchTotals!.scored);
    expect(plan.researchTotals!.taste).toBeGreaterThan(0);

    // The model fails: the engine's plan, with totals from the engine's data (never missing).
    const failed = await load();
    const { plan: fallback } = await failed.runPlanAgent(failed.ctx, {}, undefined, { model: failed.createMockPlanner("fail") });
    expect(fallback.explanations).toBe("template");
    const [ranked, cells, footfall] = await Promise.all([failed.ctx.ranked(), failed.ctx.tasteCells(), failed.ctx.footfall()]);
    const engine = fromEngine({ cells: cells.length, crowdReads: 0, pool: ranked, sensors: footfall.sensors, setlists: fallback.pitches.map((p) => p.setlist) });
    expect({ ...fallback.researchTotals, crowds: 0, qlooCalls: undefined, qlooCacheHits: undefined }).toEqual(engine);
    expect(fallback.researchTotals!.scored).toBe(ranked.length);
    expect(fallback.researchTotals!.taste).toBe(cells.length);
    expect(fallback.researchTotals!.crowds).toBeGreaterThanOrEqual(1);

    // run=0 (engine only, no agent): the field is there too.
    const { buildEnginePlan } = await import("@/server/agent/preload");
    const engineOnly = await buildEnginePlan(request, OFFLINE, "2026-10-15");
    // run=0 runs no agent, so it has no busk Qloo usage fields.
    expect(engineOnly.researchTotals).toEqual({ ...fallback.researchTotals, qlooCalls: undefined, qlooCacheHits: undefined });
  });

  it("running totals after each tool-end never decrease, and the last one is the plan's stored totals", async () => {
    const { ctx, runPlanAgent, createMockPlanner } = await load();
    const seen: string[] = [];
    const totals: Record<string, number>[] = [];
    const { plan } = await runPlanAgent(
      ctx,
      { onToolEnd: () => seen.push("end"), onTotals: (t) => (seen.push("totals"), totals.push(t)) },
      undefined,
      { model: createMockPlanner() },
    );
    expect(plan.explanations).toBe("ai");
    // One totals event right after each tool-end.
    expect(seen.length).toBeGreaterThan(4);
    expect(seen).toEqual(seen.map((_, i) => (i % 2 === 0 ? "end" : "totals")));
    for (let i = 1; i < totals.length; i++) for (const k of Object.keys(totals[i])) expect(totals[i][k]).toBeGreaterThanOrEqual(totals[i - 1][k]);
    // The data totals end on the stored ones; Qloo usage keeps counting while the plan is assembled, so the
    // stored counts are at least the last running ones (the route sends the stored totals last).
    const { qlooCalls, qlooCacheHits, ...data } = totals.at(-1)!;
    const { qlooCalls: storedCalls, qlooCacheHits: storedHits, ...storedData } = plan.researchTotals!;
    expect(data).toEqual(storedData);
    expect(storedCalls).toBeGreaterThanOrEqual(qlooCalls);
    expect(storedHits).toBeGreaterThanOrEqual(qlooCacheHits);
    expect(totals[0]).not.toEqual(totals.at(-1));
  });
});
