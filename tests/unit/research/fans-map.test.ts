import { beforeEach, describe, expect, it, vi } from "vitest";
import { fansMapProps, fansMapSummary, planBuskHref } from "@/lib/fans-map";
import type { LearnStreamEvent } from "@/lib/learn-schema";
import { RESEARCH_STEPS, RESEARCH_TOOLS, type FansMapOutput, type ResearchSnapshot } from "@/lib/repertoire-research";
import { toRepertoireView } from "@/lib/repertoire-research-view";
import { CATALOG } from "@/server/qloo-mock/catalog";
import { cache, cachedLookupScope, setupFetch } from "../learn/helpers";

vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return { ...original, lookupScope: cachedLookupScope(original) };
});

const OFF = { offline: true, faults: [] } as const;
const julia = CATALOG.find((a) => a.name === "Julia Jacklin")!;
const HAVANA = { lat: 23.13, lon: -82.38 };

beforeEach(() => cache.clear());

describe("the /busks link and the FansMap props", () => {
  it("links to /busks, with the city prefilled only when Busk Map covers the top place", () => {
    expect(planBuskHref("melbourne")).toBe("/busks?city=melbourne");
    expect(planBuskHref(null)).toBe("/busks");
    expect(planBuskHref()).toBe("/busks");
  });
  it("maps the output onto BRAND's props with no city", () => {
    const out: FansMapOutput = { summary: "x", cells: [{ lat: -37.8, lng: 144.9, affinity: 1 }], areas: ["A", "B", "C", "D"], planCity: "melbourne", signalledBy: ["Julia Jacklin"] };
    expect(fansMapProps(out)).toEqual({ cells: out.cells, topAreas: ["A", "B", "C"], planHref: "/busks?city=melbourne" });
    expect(fansMapProps({ ...out, planCity: null }).planHref).toBe("/busks");
  });
  it("says the places in the Hive's voice, with no city", () => {
    expect(fansMapSummary(["Havana", "Miami", "Madrid"])).toBe("Your crowd is strongest in Havana, Miami and Madrid");
    expect(fansMapSummary(["Havana"])).toBe("Your crowd is strongest in Havana");
    expect(fansMapSummary([])).toMatch(/no clear pocket/);
  });
});

describe("naming the top places worldwide", () => {
  const cell = (p: { lat: number; lon: number }, affinity: number) => ({ ...p, geohash: null, affinity, affinityRank: null, popularity: null });
  it("names distinct cities, not three cells of one", async () => {
    const { topPlaces } = await import("@/server/research/fans-map");
    const { areas, planCity } = topPlaces([
      cell(HAVANA, 1),
      cell({ lat: 23.14, lon: -82.37 }, 0.99),
      cell({ lat: 23.12, lon: -82.39 }, 0.98),
      cell({ lat: 25.77, lon: -80.2 }, 0.9),
      cell({ lat: 40.41, lon: -3.7 }, 0.8),
      cell({ lat: -34.6, lon: -58.4 }, 0.7),
    ]);
    expect(areas).toEqual(["Havana", "Miami", "Madrid"]);
    expect(planCity).toBeNull();
  });
  it("names a cell inside a Busk Map city the planner's way, and offers that city to plan in", async () => {
    const { topPlaces } = await import("@/server/research/fans-map");
    const { CITIES } = await import("@/server/cities");
    const { areas, planCity } = topPlaces([cell(CITIES.melbourne.center, 1), cell(HAVANA, 0.5)]);
    expect(planCity).toBe("melbourne");
    expect(areas[1]).toBe("Havana");
    expect(areas[0]).toBeTruthy();
  });
  it("skips cells far from any listed city", async () => {
    const { topPlaces } = await import("@/server/research/fans-map");
    expect(topPlaces([cell({ lat: -45, lon: -140 }, 1)]).areas).toEqual([]);
  });
});

describe("the heatmap call (offline Qloo mock)", () => {
  it("returns relative cells spread worldwide and up to three distinct named places, signalled by the act", async () => {
    vi.resetModules();
    await setupFetch();
    const { fansMapFor } = await import("@/server/research/fans-map");
    const out = await fansMapFor({ own: { id: julia.id, name: "Julia Jacklin" }, alikes: [], adapters: OFF });
    expect(out).not.toHaveProperty("city");
    // The mock answers a world polygon with cells on several continents.
    expect(out.cells.some((c) => c.lng < -30)).toBe(true);
    expect(out.cells.some((c) => c.lng > 100)).toBe(true);
    expect(out.cells.some((c) => c.lat > 30)).toBe(true);
    expect(out.areas.length).toBe(3);
    expect(out.summary).toBe(`Your crowd is strongest in ${out.areas[0]}, ${out.areas[1]} and ${out.areas[2]}`);
    expect(out.cells.length).toBeGreaterThan(0);
    expect(Math.max(...out.cells.map((c) => c.affinity))).toBe(1);
    for (const c of out.cells) expect(Object.keys(c).sort()).toEqual(["affinity", "lat", "lng"]);
    expect(out.areas.length).toBeLessThanOrEqual(3);
    expect(new Set(out.areas).size).toBe(out.areas.length);
    expect(out.signalledBy).toEqual(["Julia Jacklin"]);
  });

  it("one Qloo call per act: the world is answered from the cache the second time, another area is a new call", async () => {
    vi.resetModules();
    await setupFetch();
    const qloo = await import("@/server/adapters/qloo");
    const { CITIES } = await import("@/server/cities");
    // The Qloo client's cache body runs once per (signal, area): the helper's map holds one entry per lookup that went to Qloo.
    const heat = () => [...cache.keys()].filter((k) => k.startsWith('["heatmap"')).length;
    const { WORLD_BBOX } = await import("@/lib/fans-map");
    await qloo.tasteMap([julia.id], WORLD_BBOX, OFF);
    expect(heat()).toBe(1);
    await qloo.tasteMap([julia.id], WORLD_BBOX, OFF);
    expect(heat()).toBe(1);
    await qloo.tasteMap([julia.id], CITIES.melbourne.bbox, OFF);
    expect(heat()).toBe(2);
  });
});

describe("the research step (offline)", () => {
  async function load() {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
    (await import("@/server/learn/store")).resetLearnStoresForTests();
    (await import("@/server/learn/runs")).clearLearnRunsForTests();
    return { research: await import("@/app/api/playlist/research/route"), playlist: await import("@/app/api/playlist/route") };
  }
  const req = (method: string, path: string, body?: unknown, cookie?: string) =>
    new Request(`http://localhost:3100/api/playlist${path}`, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

  it("runs after Who your fans are and is saved in the snapshot, with no city", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: julia.spotifyId }));
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const events = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as LearnStreamEvent);
    const tools = events.flatMap((e) => (e.type === "tool-end" ? [e.tool] : []));
    expect(RESEARCH_STEPS.indexOf("fansMap")).toBe(RESEARCH_STEPS.indexOf("fans") + 1);
    expect(tools.indexOf(RESEARCH_TOOLS.fansMap)).toBe(tools.indexOf(RESEARCH_TOOLS.fans) + 1);
    expect(RESEARCH_TOOLS.fansMap).toBe("research_fans_map");

    const snap = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist.research as ResearchSnapshot;
    const saved = snap.steps.fansMap!;
    expect(saved.status).toBe("done");
    expect(saved.output!.cells.length).toBeGreaterThan(0);
    expect(saved.output!.signalledBy[0]).toBe("Julia Jacklin");
    expect(saved.output!.signalledBy.length).toBeGreaterThan(1); // the sound-alikes

    const view = toRepertoireView({ snapshot: snap });
    expect(view.results.fansMap).toEqual(saved.output);
    expect(saved.output).not.toHaveProperty("city");
    expect(saved.output!.areas.length).toBeGreaterThan(0);
  });
});

describe("saved research from before the map was global", () => {
  it("a snapshot that still carries `city` parses and the view ignores it", () => {
    const old = { summary: "x", city: { id: "melbourne", name: "Melbourne", center: [144.96, -37.81], zoom: 12 }, cells: [{ lat: -37.8, lng: 144.9, affinity: 1 }], areas: ["Fitzroy"], signalledBy: ["X"] } as FansMapOutput;
    expect(fansMapProps(old)).toEqual({ cells: old.cells, topAreas: ["Fitzroy"], planHref: "/busks" });
  });
});

describe("saved research from before this step", () => {
  it("still parses: the map is null, the step reads as skipped, nothing throws", () => {
    const old: ResearchSnapshot = {
      version: 1,
      spotifyArtistId: "x",
      fullRunId: "r1",
      runId: "r1",
      runNumber: 1,
      mode: "full",
      at: "2026-10-17T00:00:00.000Z",
      steps: { profile: { status: "done", output: { summary: "Read X", spotifyId: "x", name: "X", image: null, genres: [], followers: null, href: "https://open.spotify.com/artist/x" } } },
    };
    const v = toRepertoireView({ snapshot: old });
    expect(v.results.fansMap).toBeNull();
    expect(v.steps.find((s) => s.key === "fansMap")?.status).toBe("skipped");
    expect(v.results.profile?.name).toBe("X");
  });
});
