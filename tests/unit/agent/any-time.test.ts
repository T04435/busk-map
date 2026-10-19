import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * Any time (plan-inputs-architecture.md 2, stages S2 and S3), with the mock model and the Qloo mock: the engine picks each
 * pitch's window, best_hours explains it, and the plan carries it. Fixed requests are unchanged.
 */
const anyRequest = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", any: true }, performer: EXAMPLES[0].performer });
const fixedRequest = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer });

async function load() {
  vi.resetModules();
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const agent = await import("@/server/agent/agent");
  const tools = await import("@/server/agent/tools");
  const mock = await import("@/server/agent/mock-model");
  return { PlanContext, ...agent, ...tools, ...mock };
}

type Exec = (input: unknown, options: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown } | undefined, input: unknown) => (t!.execute as Exec)(input, { toolCallId: "t", messages: [] });

async function runAgent(request: typeof anyRequest, nowHour = 9) {
  const { PlanContext, runPlanAgent } = await load();
  const started: { tool: string; input: unknown }[] = [];
  const ended: { tool: string; ok: boolean; summary: string; output: unknown }[] = [];
  const ctx = new PlanContext(request, OFFLINE, "2026-10-15", nowHour);
  const result = await runPlanAgent(ctx, { onToolStart: (e) => started.push(e), onToolEnd: (e) => ended.push(e) });
  return { ...result, started, ended, ctx };
}

describe("any-time plan (mock model)", () => {
  it("scores each pitch at its own best window, calls best_hours after score_pitches, and carries the windows on the plan", async () => {
    const { plan, started, ended } = await runAgent(anyRequest);
    expect(() => planSchema.parse(plan)).not.toThrow();
    const tools = started.map((s) => s.tool);
    expect(tools.indexOf("best_hours")).toBeGreaterThan(tools.indexOf("score_pitches"));
    expect(tools.indexOf("best_hours")).toBeLessThan(tools.indexOf("finish_plan"));
    expect(ended.every((e) => e.ok)).toBe(true);

    expect(plan.anyTime).toBe(true);
    expect(plan.pitches).toHaveLength(3);
    for (const p of plan.pitches) {
      expect(p.window).toMatchObject({ label: expect.stringMatching(/\d+ [ap]m–\d+ [ap]m/), score: p.score, why: expect.stringMatching(/^Best /) });
      expect(p.window!.endHour - p.window!.startHour).toBe(3);
      expect(p.window!.runnersUp).toHaveLength(2);
      expect(p.window!.startHour).toBeGreaterThanOrEqual(10);
      expect(p.window!.endHour).toBeLessThanOrEqual(22);
    }
    // plan.slot is the top pitch's window, so every existing reader still gets a real slot.
    expect(plan.slot).toEqual({ date: "2026-10-17", startHour: plan.pitches[0].window!.startHour, endHour: plan.pitches[0].window!.endHour });
    expect(plan.slotLabel).toBe("Saturday 2026-10-17, any time, Busk Map picks the hours");
    expect(plan.researchTotals!.windows).toBe(10);
    // The mock model says each pitch's hours (from best_hours), and the numbers check accepted them.
    expect(plan.explanations).toBe("ai");
    expect(plan.pitches[0].why).toContain(`Best hours ${plan.pitches[0].window!.label}`);
    // The weather strip spans the day.
    expect(plan.weather!.hours.map((h) => h.hour)).toEqual(Array.from({ length: 12 }, (_, i) => 10 + i));
  });

  it("best_hours returns the top 3 windows, the activity estimate by hour, events, rain and open places; score_pitches rows gain `window` additively", async () => {
    const { ended } = await runAgent(anyRequest);
    const scored = ended.find((e) => e.tool === "score_pitches")!.output as { windows: number; pitches: { pitchId: string; window: string; windowStartHour: number }[]; poolSize: number };
    expect(scored.windows).toBe(10);
    expect(scored.pitches.every((p) => /\d+ [ap]m–\d+ [ap]m/.test(p.window))).toBe(true);
    const out = ended.find((e) => e.tool === "best_hours")!.output as {
      summary: string;
      windowsScored: number;
      pitches: { pitchId: string; name: string; best: string; windows: { window: string; score: number; activity: number | null; rainPercent: number | null; events: unknown[]; placesOpen: string[] }[]; hourly: { hour: number; activity: number | null; rainPercent: number | null }[]; activityBasis: string; peakHour: number | null }[];
    };
    expect(out.windowsScored).toBe(10);
    expect(out.summary).toMatch(/^Best \d+ [ap]m–\d+ [ap]m at /);
    expect(out.pitches).toHaveLength(3);
    for (const p of out.pitches) {
      expect(p.windows).toHaveLength(3);
      expect(p.windows[0].window).toBe(p.best);
      expect(p.windows[0].score).toBeGreaterThanOrEqual(p.windows[1].score);
      expect(p.windows[1].score).toBeGreaterThanOrEqual(p.windows[2].score);
      expect(p.hourly.map((h) => h.hour)).toEqual(Array.from({ length: 12 }, (_, i) => 10 + i));
      expect(p.windows[0].rainPercent).not.toBeNull();
      expect(p.windows[0].activity).not.toBeNull();
      expect(p.hourly.every((h) => h.activity === null || (h.activity >= 0 && h.activity <= 1))).toBe(true);
    }
    // Different pitches peak at different hours somewhere in the pool (the offline Qloo places have different hours).
    expect(new Set(out.pitches.map((p) => p.best)).size).toBeGreaterThanOrEqual(1);
  });

  it("is not offered, and plans stay as they were, for a fixed slot", async () => {
    const { plan, started, ctx } = await runAgent(fixedRequest as typeof anyRequest);
    const { createTools, AgentState } = await load();
    expect(Object.keys(createTools(ctx, new AgentState()))).not.toContain("best_hours");
    expect(started.map((s) => s.tool)).not.toContain("best_hours");
    expect(plan.anyTime).toBe(false);
    expect(plan.pitches.every((p) => p.window === null)).toBe(true);
    expect(plan.slot).toEqual({ date: "2026-10-17", startHour: 18, endHour: 21 });
    expect(plan.researchTotals!.windows).toBeUndefined();
    expect(plan.pitches[0].why).not.toContain("Best hours");
  });

  it("only scores windows still ahead on today's date, and says so when none is left", async () => {
    const { PlanContext } = await load();
    const noon = new PlanContext(anyRequest, OFFLINE, "2026-10-17", 12);
    expect(noon.windows().map((w) => w.startHour)).toEqual([13, 14, 15, 16, 17, 18, 19]);
    const ranked = await noon.ranked();
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((p) => p.window!.startHour >= 13)).toBe(true);
    const late = new PlanContext(anyRequest, OFFLINE, "2026-10-17", 21);
    expect(late.windows()).toEqual([]);
    expect(await late.ranked()).toEqual([]);
    expect(late.notes.join(" ")).toMatch(/No busking hours are left/);
    // A later date is untouched by the hour.
    expect(new PlanContext(anyRequest, OFFLINE, "2026-10-16", 23).windows()).toHaveLength(10);
  });

  it("best_hours needs a scored pool and known pitch ids; tool defaults follow the pitch's best window", async () => {
    const { PlanContext, createTools, AgentState } = await load();
    const ctx = new PlanContext(anyRequest, OFFLINE, "2026-10-15", 9);
    const state = new AgentState();
    const tools = createTools(ctx, state);
    await expect(run(tools.best_hours, { pitchIds: ["x"] })).rejects.toThrow(/score_pitches first/);
    await run(tools.taste_map, {});
    await run(tools.activity_at, { at: { place: "Federation Square" } });
    await run(tools.busy_places, { near: { place: "Federation Square" } });
    const scored = (await run(tools.score_pitches, {})) as { pitches: { pitchId: string; windowStartHour: number; windowEndHour: number }[] };
    await expect(run(tools.best_hours, { pitchIds: ["made-up"] })).rejects.toThrow(/Unknown pitchId/);
    const top = scored.pitches[0];
    // activity_at with no hour: the pitch's best window start. busy_places: open at that hour. events_near: the window.
    const foot = (await run(tools.activity_at, { at: { pitchId: top.pitchId } })) as { startHour: number; endHour: number };
    expect(foot.startHour).toBe(top.windowStartHour);
    expect(foot.endHour).toBe(top.windowEndHour);
    const places = (await run(tools.busy_places, { near: { pitchId: top.pitchId } })) as { hour: number };
    expect(places.hour).toBe(top.windowStartHour);
    const events = (await run(tools.events_near, { near: { pitchId: top.pitchId } })) as { window: string };
    expect(events.window).toMatch(new RegExp(`^.*–.*$`));
    // With no pitch known: the day. activity_at falls back to the busiest hour of the day; events_near spans 9 am to 10 pm.
    const spot = { lat: -37.8075, lon: 144.9405 };
    const day = (await run(tools.events_near, { near: spot })) as { window: string };
    expect(day.window).toBe("9 am–10 pm");
    const peak = (await run(tools.activity_at, { at: spot })) as { startHour: number };
    expect(peak.startHour).toBeGreaterThanOrEqual(10);
    expect(peak.startHour).toBeLessThan(22);
  });

  it("the plain-AI comparison asks for the best time of day, and spots are scored at their best window", async () => {
    vi.resetModules();
    const { comparePrompt } = await import("@/server/agent/compare");
    expect(comparePrompt(anyRequest)).toContain("When: Saturday 2026-10-17, at whatever time of day is best, in central Melbourne.");
    expect(comparePrompt(fixedRequest)).toContain("When: Saturday 2026-10-17, 6 pm–9 pm, in central Melbourne.");
  });

  it("the window's why is built from its evidence only", async () => {
    vi.resetModules();
    const { windowWhy } = await import("@/server/agent/assemble");
    const pitch = {
      window: { startHour: 18, endHour: 21, runnersUp: [] },
      activityBasis: "places",
      evidence: {
        activity: { level: 0.72, area: null, venues: 0.72 },
        places: [],
        events: [{ name: "Forum Gig", moment: "leaving", end: "2026-10-17T10:45:00Z", start: "2026-10-17T08:00:00Z", endEstimated: false }],
      },
    } as unknown as Parameters<typeof windowWhy>[0];
    const dry = [{ hour: 18, precipitationProbability: 5 }, { hour: 19, precipitationProbability: 10 }, { hour: 22, precipitationProbability: 90 }];
    expect(windowWhy(pitch, dry)).toBe("Best 6 pm–9 pm: busy (est.), the Forum Gig crowd leaving at 9:45 pm, dry");
    expect(windowWhy(pitch, [{ hour: 20, precipitationProbability: 60 }])).toContain("rain likely (up to 60%)");
    expect(windowWhy(pitch, null)).not.toMatch(/dry|rain/);
    expect(windowWhy({ ...pitch, window: undefined } as never, null)).toBe("");
  });
});
