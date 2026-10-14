import { describe, expect, it, vi } from "vitest";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

const request = planRequestSchema.parse({
  city: "melbourne",
  slot: { date: "2026-10-17", startHour: 18, endHour: 21 },
  performer: EXAMPLES[0].performer,
});

async function load() {
  vi.resetModules();
  const { PlanContext } = await import("@/server/agent/context");
  const agent = await import("@/server/agent/agent");
  const { assemblePlan } = await import("@/server/agent/assemble");
  return { PlanContext, ...agent, assemblePlan };
}

describe("plan agent (offline, mock model)", () => {
  it("calls the tools, streams steps and returns a validated plan with AI explanations", async () => {
    mockFetch([]); // offline: no network at all
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const started: string[] = [];
    const ended: { tool: string; ok: boolean; summary: string }[] = [];

    const { plan, usage } = await runPlanAgent(ctx, {
      onToolStart: (e) => started.push(e.tool),
      onToolEnd: (e) => ended.push(e),
    });

    expect(() => planSchema.parse(plan)).not.toThrow();
    expect(started).toContain("resolve_repertoire");
    expect(started).toContain("score_pitches");
    expect(started).toContain("build_setlists");
    expect(ended.every((e) => e.ok && e.summary.length > 0)).toBe(true);
    expect(usage?.steps).toBe(4);

    expect(plan.explanations).toBe("ai");
    expect(plan.qlooMode).toBe("synthetic");
    expect(plan.pitches).toHaveLength(3);
    expect(plan.pitches[0].why).toMatch(/^Mock explanation/);
    expect(plan.pitches[0].score).toBeGreaterThanOrEqual(plan.pitches[1].score);
    expect(plan.pitches.every((p) => p.setlist.length === request.performer.songs.length)).toBe(true);
    expect(plan.learnThese.length).toBeGreaterThan(0);
    expect(plan.tasteCells.length).toBeGreaterThan(0);
    expect(plan.dataStatus.map((s) => s.adapter).sort()).toEqual(["events", "footfall", "pitches", "qloo", "songs", "weather"]);
    expect(plan.dataStatus.every((s) => s.mode === "synthetic")).toBe(true);
  });

  it("falls back to template explanations when the model returns pitch ids the engine never produced", async () => {
    const { PlanContext, assemblePlan } = await load();
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const plan = await assemblePlan(ctx, { summary: "Invented", pitches: [{ pitchId: "made-up", why: "Trust me" }], notes: ["x"] });
    expect(plan.explanations).toBe("template");
    expect(plan.summary).toMatch(/^Top pitch:/);
    expect(plan.notes).toEqual([]);
    expect(plan.pitches.every((p) => p.whySource === "template" && p.why.length > 0)).toBe(true);
  });

  it("refuses to plan without Qloo, before spending tokens", async () => {
    const { PlanContext, runPlanAgent, QlooUnavailableError } = await load();
    const ctx = new PlanContext(request, { offline: true, faults: ["qloo"] }, "2026-10-15");
    await expect(runPlanAgent(ctx)).rejects.toBeInstanceOf(QlooUnavailableError);
  });

  it("still plans when other sources are down, and says what is missing", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(request, { offline: true, faults: ["footfall", "events", "weather", "songs"] }, "2026-10-15");
    const { plan } = await runPlanAgent(ctx);
    expect(plan.footfallLevel).toBe("unavailable");
    expect(plan.weather).toBeNull();
    expect(plan.pitches.length).toBeGreaterThan(0);
    // Without sensors, only designated sites remain.
    expect(plan.pitches.every((p) => p.kind === "designated")).toBe(true);
    expect(plan.dataStatus.find((s) => s.adapter === "footfall")).toMatchObject({ mode: "fallback", reason: "fault_injected" });
  });

  it("completes with template explanations when the gateway is not configured", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("QLOO_API_KEY", "");
    const { PlanContext, runPlanAgent } = await load();
    // Live context, but every provider without a key: Qloo synthetic, others fall back.
    mockFetch([]);
    const ctx = new PlanContext(request, { offline: false, faults: ["footfall", "pitches", "weather"] }, "2026-10-15");
    const { plan, usage } = await runPlanAgent(ctx);
    expect(usage).toBeNull();
    expect(plan.explanations).toBe("template");
    expect(plan.notes.join(" ")).toMatch(/not configured/);
  });
});
