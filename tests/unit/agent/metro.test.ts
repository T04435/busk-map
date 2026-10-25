import { describe, expect, it, vi } from "vitest";
import { requestFieldsOf, type CityOption } from "@/lib/city";
import type { CallRecord } from "@/lib/call-record";
import { distanceM, inBBox } from "@/lib/geo";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * A metro planned in districts (lib/city.ts isMetro, scoring/districts.ts): offline mode's Tokyo picked from the geocoder
 * (radius 15 km), whose synthetic data has taste and public spaces in its centre and three suburbs (offline-city.ts
 * OFFLINE_METRO_HUBS). Old Tokyo links (no radius) and Melbourne plan exactly as before.
 */
const TOKYO: CityOption = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };
const METRO: CityOption = { ...TOKYO, radiusKm: 15 };
const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };

async function load() {
  vi.resetModules();
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  const { recordCalls } = await import("@/server/adapters/call-log");
  const tools = await import("@/server/agent/tools");
  return { PlanContext, runPlanAgent, recordCalls, tools };
}

const requestFor = (option: CityOption, performer = EXAMPLES[0].performer) => planRequestSchema.parse({ ...requestFieldsOf(option), slot, performer });

describe("a metro planned in districts (offline Tokyo with its suburbs)", () => {
  it("finds 3 to 4 named districts and spreads the top 3 over at least two, at most 2 from one", async () => {
    for (const example of EXAMPLES) {
      const { PlanContext, runPlanAgent } = await load();
      const ctx = new PlanContext(requestFor(METRO, example.performer), OFFLINE, "2026-10-15");
      expect(ctx.metro).toBe(true);
      const { plan } = await runPlanAgent(ctx);
      expect(planSchema.safeParse(plan).success).toBe(true);
      const districts = await ctx.namedDistricts();
      expect(districts.length).toBeGreaterThanOrEqual(3);
      expect(districts.length).toBeLessThanOrEqual(4);
      expect(plan.districts).toEqual(districts.map((d) => ({ name: d.name, lat: d.center.lat, lon: d.center.lon })));
      for (const d of districts) expect(d.name).toMatch(/^Synthetic OSM /);
      expect(plan.pitches).toHaveLength(3);
      const { districtOf } = await import("@/server/scoring");
      const counts = new Map<string, number>();
      for (const p of plan.pitches) {
        expect(inBBox(p, ctx.city.bbox)).toBe(true);
        const id = districtOf(p, districts)!;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      expect(counts.size, `${example.id}: ${plan.pitches.map((p) => p.name).join(", ")}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
      // Pitches beyond the old CBD-sized box: the suburbs are searched.
      expect(plan.pitches.some((p) => distanceM(p, ctx.city.center) > 3000)).toBe(true);
    }
  }, 30_000);

  it("costs at most 6 more Qloo calls and 4 more Overpass queries than a CBD-sized plan, one zoomed heatmap and one Overpass query per district", async () => {
    const run = async (option: CityOption) => {
      const { PlanContext, recordCalls } = await load();
      const ctx = new PlanContext(requestFor(option), OFFLINE, "2026-10-15");
      const calls: CallRecord[] = [];
      await recordCalls(calls, async () => {
        await ctx.topPitches();
        await ctx.namedDistricts();
        await Promise.all([ctx.events(), ctx.localArtists()]);
      });
      return { ctx, calls, districts: await ctx.districts() };
    };
    const old = await run(TOKYO);
    const metro = await run(METRO);
    const count = (calls: CallRecord[], pick: (c: CallRecord) => boolean) => calls.filter(pick).length;
    const qloo = (c: CallRecord) => c.provider === "qloo";
    const heatmap = (c: CallRecord) => qloo(c) && c.params["filter.type"] === "urn:heatmap";
    const osm = (c: CallRecord) => c.provider === "osm";
    expect(old.districts).toEqual([]);
    expect(count(old.calls, heatmap)).toBe(1);
    expect(count(old.calls, osm)).toBe(1);
    expect(count(metro.calls, heatmap)).toBe(1 + metro.districts.length);
    expect(count(metro.calls, osm)).toBe(metro.districts.length);
    expect(count(metro.calls, osm) - count(old.calls, osm)).toBeLessThanOrEqual(4);
    expect(count(metro.calls, qloo) - count(old.calls, qloo)).toBeLessThanOrEqual(6);
    // Busy places: still one search, over the whole area.
    const places = (c: CallRecord) => qloo(c) && c.params["filter.type"] === "urn:entity:place";
    expect(count(metro.calls, places)).toBe(count(old.calls, places));
  });

  it("an old Tokyo link (no radius) plans the CBD-sized area as before: no districts, one Overpass box", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(requestFor(TOKYO), OFFLINE, "2026-10-15");
    expect(ctx.metro).toBe(false);
    expect(ctx.city.radiusKm).toBe(3);
    const { plan } = await runPlanAgent(ctx);
    expect(plan).not.toHaveProperty("districts");
    expect(await ctx.districts()).toEqual([]);
    expect(await ctx.spread()).toBeUndefined();
    for (const p of plan.pitches) expect(inBBox(p, ctx.city.bbox)).toBe(true);
  });

  it("Melbourne has no districts and its top 3 is the plain spaced pick", async () => {
    const { PlanContext } = await load();
    const { pickTopPitches } = await import("@/server/scoring");
    const ctx = new PlanContext(planRequestSchema.parse({ city: "melbourne", slot, performer: EXAMPLES[0].performer }), OFFLINE, "2026-10-15");
    expect(ctx.metro).toBe(false);
    expect(await ctx.districts()).toEqual([]);
    expect(await ctx.topPitches()).toEqual(pickTopPitches(await ctx.ranked(), 3));
  });

  it("finish_plan rejects three pitches from one district while the pool has another, and says which district", async () => {
    const { PlanContext, tools } = await load();
    const ctx = new PlanContext(requestFor(METRO), OFFLINE, "2026-10-15");
    const state = new tools.AgentState();
    const ranked = await ctx.ranked();
    for (const p of ranked) state.pool.set(p.id, p);
    state.districts = await ctx.namedDistricts();
    const { districtOf } = await import("@/server/scoring");
    const byDistrict = new Map<string, typeof ranked>();
    for (const p of ranked) byDistrict.set(districtOf(p, state.districts)!, [...(byDistrict.get(districtOf(p, state.districts)!) ?? []), p]);
    // Three spaced pitches from the district with the most.
    const [id, pool] = [...byDistrict].sort((a, b) => b[1].length - a[1].length)[0];
    const three = pool.filter((p, i) => pool.slice(0, i).every((q) => distanceM(p, q) >= 250)).slice(0, 3);
    expect(three).toHaveLength(3);
    const answer = { pitches: three.map((p) => ({ pitchId: p.id, why: "Good spot." })), summary: "Three spots.", notes: [] };
    const problems = tools.checkAnswer(answer, state);
    expect(problems.map((p) => p.kind)).toContain("district");
    expect(problems.find((p) => p.kind === "district")!.message).toContain(state.districts.find((d) => d.id === id)!.name);
    // The same answer is fine for a city without districts.
    state.districts = [];
    expect(tools.checkAnswer(answer, state).map((p) => p.kind)).not.toContain("district");
  });
});
