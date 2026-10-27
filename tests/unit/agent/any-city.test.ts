import { describe, expect, it, vi } from "vitest";
import { MELBOURNE, requestFieldsOf } from "@/lib/city";
import { inBBox } from "@/lib/geo";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

/** V2 2.1: an offline plan in offline mode's second city (Tokyo), end to end with the mock model and the Qloo mock. */
const TOKYO = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };
const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };
/** A taste spot's name (scoring/candidates.ts tasteSpotName): area and venue, venue, or area alone, never a bare number or an ordinal. */
const TASTE_SPOT = /^(Near .+|.+ · near .+|.+ taste spot)(, [^()]+)?$/;

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
    expect(plan).toMatchObject({ city: "tokyo-jp", cityName: "Tokyo", rulesUrl: null, cityLevels: { rules: "none", pitches: "global", hotspots: "none", taste: "global" } });
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
    // V2 2.3: the pitches stand at OpenStreetMap public spaces (offline: the synthetic Overpass answer), credited as OSM.
    expect(plan.dataStatus).toContainEqual({ adapter: "osm", source: "osm", mode: "synthetic" });
    for (const p of plan.pitches) {
      expect(p.name).toMatch(/^Synthetic OSM |^Pedestrian street$/);
      expect(p.kind).toBe("public-space");
    }
  });

  it("falls back to the taste-cell pitches when OpenStreetMap is down", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const request = planRequestSchema.parse({ ...requestFieldsOf(TOKYO), slot, performer: EXAMPLES[0].performer });
    const ctx = new PlanContext(request, { offline: true, faults: ["osm"] }, "2026-10-15");
    const { plan } = await runPlanAgent(ctx);
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan.pitches.length).toBeGreaterThan(0);
    for (const p of plan.pitches) {
      expect(p.name).toMatch(TASTE_SPOT);
      expect(p.name).not.toMatch(/Taste area \d/);
    }
    expect(plan.cityLevels).toMatchObject({ pitches: "none" });
    expect(plan.dataStatus).toContainEqual({ adapter: "osm", source: "osm", mode: "fallback", reason: "fault_injected" });
  });

  it("names every taste cell in the taste map step like the pitches (never an unnamed block) when OpenStreetMap is down", async () => {
    vi.resetModules();
    mockFetch([]);
    const { PlanContext } = await import("@/server/agent/context");
    const { createTools, AgentState, cellName, cellNames } = await import("@/server/agent/tools");
    const request = planRequestSchema.parse({ ...requestFieldsOf(TOKYO), slot, performer: EXAMPLES[0].performer });
    const ctx = new PlanContext(request, { offline: true, faults: ["osm"] }, "2026-10-15");
    const tools = createTools(ctx, new AgentState());
    const out = (await (tools.taste_map.execute as (i: unknown, o: unknown) => Promise<unknown>)({}, { toolCallId: "t", messages: [] })) as {
      summary: string;
      strongest: { rank: number; near: string | null; name: string }[];
    };
    expect(out.strongest.length).toBeGreaterThan(0);
    const pitchNames = new Set((await ctx.candidates()).candidates.map((c) => c.name));
    for (const cell of out.strongest) {
      expect(cell.name).toMatch(TASTE_SPOT);
      expect(cell.name).not.toMatch(/Taste area \d/);
    }
    // A cell the engine stood a pitch on carries that pitch's name; no two cells share one.
    expect(new Set(out.strongest.map((c) => c.name)).size).toBe(out.strongest.length);
    expect(out.strongest.some((c) => pitchNames.has(c.name))).toBe(true);
    expect(out.summary).toContain(`strongest: ${out.strongest[0].name}`);
    expect(JSON.stringify(out)).not.toMatch(/unnamed|without a name/i);

    // The rule itself: a known place first, then the pitch on the cell, then its area and nearest Qloo place.
    const cell = { lat: 35.68, lon: 139.69 };
    expect(cellName(cell, [{ name: "Shibuya Crossing", lat: 35.6801, lon: 139.6901 }], [])).toBe("Shibuya Crossing");
    expect(cellName(cell, [], [{ name: "Near Hachiko", lat: 35.6802, lon: 139.69, origin: "taste" }])).toBe("Near Hachiko");
    const naming = { venues: [{ name: "Bar Hachi", lat: 35.681, lon: 139.69 }], city: "Tokyo" };
    expect(cellName(cell, [], [{ name: "Far away", lat: 35.69, lon: 139.69, origin: "taste" }], naming)).toBe("Near Bar Hachi");
    expect(cellName(cell, [], [], { city: "Tokyo" })).toBe("Tokyo taste spot");
    // Two cells by the same place: the second never repeats the first's name, and is never named with numbers (no name: left out).
    expect(cellNames([cell, { lat: 35.6805, lon: 139.6905 }], [], [], naming)).toEqual(["Near Bar Hachi", null]);
  });

  it("names a point given by coordinates like the cells and pitches in step titles and summaries, never as raw numbers", async () => {
    vi.resetModules();
    mockFetch([]);
    const { PlanContext } = await import("@/server/agent/context");
    const { createTools, AgentState, pointName } = await import("@/server/agent/tools");
    const request = planRequestSchema.parse({ ...requestFieldsOf(TOKYO), slot, performer: EXAMPLES[0].performer });
    const ctx = new PlanContext(request, { offline: true, faults: ["osm"] }, "2026-10-15");
    const tools = createTools(ctx, new AgentState());
    const exec = (t: { execute?: unknown }, input: unknown) => (t.execute as (i: unknown, o: unknown) => Promise<unknown>)(input, { toolCallId: "t", messages: [] });
    const [pitch] = (await ctx.candidates()).candidates;
    // A point 40 m off a taste-area pitch takes that pitch's name.
    const off = { lat: pitch.lat + 0.0003, lon: pitch.lon };
    const crowd = (await exec(tools.crowd_at, { at: off })) as { summary: string; at: { label: string } };
    expect(crowd.at.label).toBe(/^Near /.test(pitch.name) ? pitch.name.replace(/^Near /, "near ") : pitch.name);
    const places = (await exec(tools.busy_places, { near: off })) as { summary: string };
    for (const text of [crowd.summary, crowd.at.label, places.summary]) expect(text).not.toMatch(/-?\d+\.\d{4}, -?\d+\.\d{4}/);

    // The rule: a known place, a pitch on the spot, the top taste cell there, the nearest pitch, the city.
    const p = { lat: 38.711, lon: -9.1276 };
    expect(pointName(p, [{ name: "Praça do Comércio", lat: 38.7112, lon: -9.1277 }], [], [], "Lisbon")).toBe("near Praça do Comércio");
    expect(pointName(p, [], [{ name: "Baixa · near Rossio", lat: 38.7111, lon: -9.1276, origin: "taste" }], [], "Lisbon")).toBe("Baixa · near Rossio");
    expect(pointName(p, [], [{ name: "Lisbon taste spot", lat: 38.7111, lon: -9.1276 }], [], "Lisbon")).toBe("Lisbon taste spot");
    expect(pointName(p, [], [{ name: "Near Rossio", lat: 38.7111, lon: -9.1276 }], [], "Lisbon")).toBe("near Rossio");
    expect(pointName(p, [], [{ name: "Far pitch", lat: 38.72, lon: -9.1276 }], [{ lat: 38.7111, lon: -9.1277, rank: 5 }], "Lisbon")).toBe("Lisbon taste spot");
    expect(pointName(p, [], [], [{ lat: 38.7111, lon: -9.1277, rank: 5 }], "Lisbon", [], [{ name: "Café Nicola", lat: 38.7125, lon: -9.1277 }])).toBe("near Café Nicola");
    expect(pointName(p, [], [{ name: "Far pitch", lat: 38.72, lon: -9.1276 }], [], "Lisbon")).toBe("near Far pitch");
    expect(pointName(p, [], [], [], "Lisbon")).toBe("a spot in Lisbon");
    // A metro: the named area the point is in, before a pitch further away; an area too far is not "in".
    expect(pointName(p, [], [{ name: "Far pitch", lat: 38.72, lon: -9.1276 }], [], "Lisbon", [{ name: "Baixa", lat: 38.712, lon: -9.137 }])).toBe("a spot in Baixa");
    expect(pointName(p, [], [], [], "Lisbon", [{ name: "Belém", lat: 38.697, lon: -9.206 }])).toBe("a spot in Lisbon");
  });

  it("keeps a Melbourne plan on Melbourne's own data", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const request = planRequestSchema.parse({ city: "melbourne", slot, performer: EXAMPLES[0].performer });
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const { plan } = await runPlanAgent(ctx);
    expect(plan).toMatchObject({ city: "melbourne", cityName: "Melbourne", rulesUrl: "https://www.melbourne.vic.gov.au/busking", cityLevels: { rules: "local" } });
    expect(plan.pitches.every((p) => inBBox(p, MELBOURNE.bbox) || Math.abs(p.lat - MELBOURNE.center.lat) < 0.05)).toBe(true);
    expect(plan.dataStatus.map((s) => s.adapter)).toContain("pitches");
    // Melbourne keeps its curated spots: no Overpass call, no OSM status.
    expect(plan.dataStatus.map((s) => s.adapter)).not.toContain("osm");
    expect(plan.cityLevels).toMatchObject({ pitches: "local" });
  });
});
