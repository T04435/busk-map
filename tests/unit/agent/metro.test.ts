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
      // Seeded by the named areas: each district is one, by its name.
      for (const d of districts) expect(d.name).toMatch(/^(Tokyo|Synthetic (Shibuya|Asakusa|Ueno|Nakano))$/);
      expect(plan.areas?.filter((a) => a.zoomed).map((a) => a.name).sort()).toEqual(districts.map((d) => d.name).sort());
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

  it("costs at most 10 more Qloo calls and 6 more Overpass queries than a CBD-sized plan: one zoomed heatmap and one Overpass query per district, one areas query", async () => {
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
    // The named areas: one Overpass query, ranked from the one whole-area heatmap (no Qloo call of their own).
    const areasQuery = (c: CallRecord) => osm(c) && c.params.place !== undefined;
    expect(count(metro.calls, areasQuery)).toBe(1);
    expect(count(old.calls, areasQuery)).toBe(0);
    expect(count(metro.calls, osm)).toBe(metro.districts.length + 1);
    expect(count(metro.calls, osm) - count(old.calls, osm)).toBeLessThanOrEqual(6);
    expect(count(metro.calls, qloo) - count(old.calls, qloo)).toBeLessThanOrEqual(10);
    expect(count(metro.calls, (c) => c.provider === "geocode")).toBe(0);
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
    expect(plan).not.toHaveProperty("areas");
    expect(await ctx.rankedAreas()).toEqual([]);
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
    expect(await ctx.namedAreas()).toEqual({ areas: [], source: "none" });
    expect(await ctx.mapCells()).toBe(await ctx.tasteCells());
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

  it("ranks the named areas from the coarse heatmap and zooms into the best four, spread apart", async () => {
    const { PlanContext } = await load();
    const ctx = new PlanContext(requestFor(METRO), OFFLINE, "2026-10-15");
    const ranked = await ctx.rankedAreas();
    // The city, its three suburbs with taste and one more; the neighbourhood next to a hub is the same area.
    expect(ranked.map((a) => a.name).sort()).toEqual(["Synthetic Asakusa", "Synthetic Nakano", "Synthetic Shibuya", "Synthetic Ueno", "Tokyo"]);
    expect(ranked.map((a) => a.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(ranked[0].share).toBe(1);
    const districts = await ctx.districts();
    expect(districts.every((d) => d.area)).toBe(true);
    expect(districts.map((d) => d.name)).toEqual(ranked.slice(0, 4).map((a) => a.name));
    // The map draws the coarse read across the whole area as well as the close-up cells.
    const [map, scored] = await Promise.all([ctx.mapCells(), ctx.tasteCells()]);
    expect(map.length).toBeGreaterThan(scored.length);
    expect(map.some((c) => !districts.some((d) => inBBox(c, d.bbox)))).toBe(true);
  });

  it("with OpenStreetMap down, names the areas after the suburbs in Qloo's place addresses", async () => {
    const { PlanContext } = await load();
    const ctx = new PlanContext(requestFor(METRO), { offline: true, faults: ["osm"] }, "2026-10-15");
    const { areas, source } = await ctx.namedAreas();
    expect(source).toBe("qloo");
    expect(areas.map((a) => a.name)).toEqual(expect.arrayContaining(["Tokyo", "Synthetic Shibuya", "Synthetic Asakusa"]));
    const districts = await ctx.districts();
    expect(districts.some((d) => d.area)).toBe(true);
  });

  it("falls back to the heatmap's peaks when no named area comes back", async () => {
    const { PlanContext } = await load();
    const ctx = new PlanContext(requestFor(METRO), { offline: true, faults: ["osm"] }, "2026-10-15");
    // No suburb in Qloo's addresses either.
    vi.spyOn(ctx, "namingPlaces").mockResolvedValue([]);
    expect(await ctx.rankedAreas()).toEqual([]);
    const districts = await ctx.districts();
    expect(districts.length).toBeGreaterThanOrEqual(2);
    expect(districts.some((d) => d.area)).toBe(false);
  });

  it("the Hive compares the areas first and its step names them, never coordinates", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(requestFor(METRO), OFFLINE, "2026-10-15");
    const steps: { tool: string; label: string; summary?: string }[] = [];
    await runPlanAgent(ctx, {
      onToolStart: (e) => steps.push({ tool: e.tool, label: e.label }),
      onToolEnd: (e) => Object.assign(steps.find((s) => s.tool === e.tool && s.summary === undefined)!, { summary: e.summary }),
    });
    expect(steps[0]).toMatchObject({ tool: "compare_areas", label: "Comparing areas across the city" });
    expect(steps[0].summary).toMatch(/^Looked at (Tokyo|Synthetic \w+)(, (Tokyo|Synthetic \w+))+$/);
    expect(steps[0].summary).toContain("Synthetic Shibuya");
    for (const s of steps) expect(`${s.label} ${s.summary}`).not.toMatch(/-?\d+\.\d{3,}, -?\d+\.\d{3,}/);
  });

  it("offers compare_areas only to a metro: the Melbourne and old-link prompts and tools are unchanged", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const { buildPrompt } = await import("@/server/agent/agent");
    for (const request of [planRequestSchema.parse({ city: "melbourne", slot, performer: EXAMPLES[0].performer }), requestFor(TOKYO)]) {
      const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
      const tools: string[] = [];
      await runPlanAgent(ctx, { onToolStart: (e) => tools.push(e.tool) });
      expect(tools).not.toContain("compare_areas");
      expect(buildPrompt(ctx, [])).not.toMatch(/compare_areas|planned across its areas/);
    }
    const metro = new PlanContext(requestFor(METRO), OFFLINE, "2026-10-15");
    const ranked = await metro.rankedAreas();
    expect(buildPrompt(metro, [], { names: ranked.map((a) => a.name), searched: ["Tokyo"] })).toContain("Tokyo is planned across its areas: ");
  });
});
