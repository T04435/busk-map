import { describe, expect, it, vi } from "vitest";
import { requestFieldsOf } from "@/lib/city";
import { planRequestSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

/** V2 2.4: outside Melbourne the plan never reads as "allowed"; Melbourne's rules wording is unchanged. */
const TOKYO = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };
const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };

async function load(fields: { city: string; place?: unknown }) {
  vi.resetModules();
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const agent = await import("@/server/agent/agent");
  const tools = await import("@/server/agent/tools");
  const request = planRequestSchema.parse({ ...fields, slot, performer: EXAMPLES[0].performer });
  const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
  return { ctx, ...agent, ...tools };
}

type Exec = (input: unknown, options: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown }, input: unknown) => (t.execute as Exec)(input, { toolCallId: "t", messages: [] });

describe("rules not checked outside Melbourne", () => {
  it("Tokyo: check_pitch looks at a spot and says the rules aren't checked; no pitch reads as allowed", async () => {
    const { ctx, createTools, AgentState, toolStart, buildPrompt, runPlanAgent } = await load(requestFieldsOf(TOKYO));
    const tools = createTools(ctx, new AgentState());
    const out = (await run(tools.check_pitch, { spot: { lat: TOKYO.lat + 0.002, lon: TOKYO.lon + 0.002 } })) as { legal: string; summary: string };
    expect(out.legal).toBe("not checked");
    expect(out.summary).toMatch(/local busking rules not checked/);
    expect(JSON.stringify(out)).not.toMatch(/not ruled out|council|General permit/);
    expect(toolStart("check_pitch", ctx.levels)).toEqual({ label: "Looking at a spot (local busking rules not checked)", source: "Busk Map public spaces; local busking rules not checked" });
    expect(buildPrompt(ctx, [])).toContain("This city's busking rules are not checked");
    const { plan } = await runPlanAgent(ctx);
    expect(plan.pitches.length).toBeGreaterThan(0);
    for (const p of plan.pitches) {
      expect(p.rules).toBe("Local busking rules not checked: check with the city before you play.");
      expect(p.cautions.join(" ")).not.toMatch(/General permit|council/);
    }
  });

  it("Melbourne: the council's wording, sources and cautions are as before", async () => {
    const { ctx, createTools, AgentState, toolStart, buildPrompt } = await load({ city: "melbourne" });
    const tools = createTools(ctx, new AgentState());
    const out = (await run(tools.check_pitch, { spot: { place: "Federation Square" } })) as { legal: string };
    expect(out.legal).toBe("not ruled out");
    expect(toolStart("check_pitch", ctx.levels)).toEqual({ label: "Checking a spot against the busking rules", source: "City of Melbourne busking layers" });
    expect(buildPrompt(ctx, [])).not.toContain("not checked");
    const pool = await ctx.ranked();
    expect(pool.some((p) => p.cautions.some((c) => c.startsWith("General permit")))).toBe(true);
  });
});
