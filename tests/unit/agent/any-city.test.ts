import { describe, expect, it, vi } from "vitest";
import { MELBOURNE, requestFieldsOf } from "@/lib/city";
import { inBBox } from "@/lib/geo";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

/** V2 2.1: an offline plan in offline mode's second city (Tokyo), end to end with the mock model and the Qloo mock. */
const TOKYO = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };
const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };

async function load() {
  vi.resetModules();
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  return { PlanContext, runPlanAgent };
}

describe("a plan in Tokyo (offline)", () => {
  it("plans inside Tokyo's planning area, in Tokyo time, with no Melbourne data", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const request = planRequestSchema.parse({ ...requestFieldsOf(TOKYO), slot, performer: EXAMPLES[0].performer });
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    expect(ctx.city).toMatchObject({ id: "tokyo-jp", timeZone: "Asia/Tokyo" });
    const { plan } = await runPlanAgent(ctx);
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan).toMatchObject({ city: "tokyo-jp", cityName: "Tokyo", rulesUrl: null, cityLevels: { rules: "none", pitches: "none", hotspots: "none", taste: "global" } });
    // Taste cells and pitches are in Tokyo, not Melbourne.
    expect(plan.tasteCells.length).toBeGreaterThan(0);
    expect(plan.tasteCells.every((c) => Math.abs(c.lat - TOKYO.lat) < 0.2 && Math.abs(c.lon - TOKYO.lon) < 0.2)).toBe(true);
    expect(plan.pitches.length).toBeGreaterThan(0);
    for (const p of plan.pitches) {
      expect(inBBox(p, ctx.city.bbox)).toBe(true);
      expect(p.usualSpot).toBeNull();
      expect(p.rules).toMatch(/not checked/);
    }
    expect(plan.zones).toEqual([]);
    // No City of Melbourne layers were asked for.
    expect(plan.dataStatus.map((s) => s.adapter)).not.toContain("pitches");
    expect(JSON.stringify(plan.pitches)).not.toMatch(/Federation|Bourke|Flinders|Melbourne/);
  });

  it("keeps a Melbourne plan on Melbourne's own data", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const request = planRequestSchema.parse({ city: "melbourne", slot, performer: EXAMPLES[0].performer });
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const { plan } = await runPlanAgent(ctx);
    expect(plan).toMatchObject({ city: "melbourne", cityName: "Melbourne", rulesUrl: "https://www.melbourne.vic.gov.au/busking", cityLevels: { rules: "local" } });
    expect(plan.pitches.every((p) => inBBox(p, MELBOURNE.bbox) || Math.abs(p.lat - MELBOURNE.center.lat) < 0.05)).toBe(true);
    expect(plan.dataStatus.map((s) => s.adapter)).toContain("pitches");
  });
});
