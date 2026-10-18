import { beforeEach, describe, expect, it, vi } from "vitest";
import { fansMapProps, fansMapSummary, planBuskHref, resolveFansMapCity } from "@/lib/fans-map";
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
const IN_MELBOURNE = { lat: -37.8136, lon: 144.9653 };
const ELSEWHERE = { lat: 51.5, lon: -0.12 };

beforeEach(() => cache.clear());

describe("which city the map opens on", () => {
  it("usual pitches first, then the last busk, then the Repertoire's city, then the busk form's default", () => {
    expect(resolveFansMapCity({ usualPitches: [ELSEWHERE, IN_MELBOURNE], recentBusks: [], city: "nowhere" })).toBe("melbourne");
    expect(resolveFansMapCity({ usualPitches: [], recentBusks: [IN_MELBOURNE], city: "nowhere" })).toBe("melbourne");
    expect(resolveFansMapCity({ usualPitches: [ELSEWHERE], recentBusks: [], city: "melbourne" })).toBe("melbourne");
    expect(resolveFansMapCity({ city: "paris" })).toBe("melbourne");
    expect(resolveFansMapCity({})).toBe("melbourne");
  });
});

describe("the /busks link and the FansMap props", () => {
  it("links to /busks with the city prefilled", () => {
    expect(planBuskHref("melbourne")).toBe("/busks?city=melbourne");
  });
  it("maps the output onto BRAND's props with no reshaping", () => {
    const out: FansMapOutput = { summary: "x", city: { id: "melbourne", name: "Melbourne", center: [144.96, -37.81], zoom: 12 }, cells: [{ lat: -37.8, lng: 144.9, affinity: 1 }], areas: ["A", "B", "C", "D"], signalledBy: ["Julia Jacklin"] };
    const p = fansMapProps(out, true);
    expect(p).toMatchObject({ city: out.city, cells: out.cells, topAreas: ["A", "B", "C"], planHref: "/busks?city=melbourne", busy: true });
    expect(p.cities).toEqual([{ id: "melbourne", name: "Melbourne" }]);
  });
  it("says the areas in the Hive's voice", () => {
    expect(fansMapSummary(["Fitzroy", "Brunswick", "the CBD"], "Melbourne")).toBe("Your crowd is strongest around Fitzroy, Brunswick and the CBD");
    expect(fansMapSummary([], "Melbourne")).toMatch(/no clear pocket/);
  });
});

describe("the heatmap call (offline Qloo mock)", () => {
  it("returns relative cells and up to three named areas, signalled by the act", async () => {
    vi.resetModules();
    await setupFetch();
    const { fansMapFor } = await import("@/server/research/fans-map");
    const out = await fansMapFor({ cityId: "melbourne", own: { id: julia.id, name: "Julia Jacklin" }, alikes: [], adapters: OFF });
    expect(out.city).toMatchObject({ id: "melbourne", name: "Melbourne" });
    expect(out.cells.length).toBeGreaterThan(0);
    expect(Math.max(...out.cells.map((c) => c.affinity))).toBe(1);
    for (const c of out.cells) expect(Object.keys(c).sort()).toEqual(["affinity", "lat", "lng"]);
    expect(out.areas.length).toBeLessThanOrEqual(3);
    expect(new Set(out.areas).size).toBe(out.areas.length);
    expect(out.signalledBy).toEqual(["Julia Jacklin"]);
  });

  it("one Qloo call per city: the same city is answered from the cache, another area is a new call", async () => {
    vi.resetModules();
    await setupFetch();
    const qloo = await import("@/server/adapters/qloo");
    const { CITIES } = await import("@/server/cities");
    // The Qloo client's cache body runs once per (signal, area): the helper's map holds one entry per lookup that went to Qloo.
    const heat = () => [...cache.keys()].filter((k) => k.startsWith('["heatmap"')).length;
    await qloo.tasteMap([julia.id], CITIES.melbourne.bbox, OFF);
    expect(heat()).toBe(1);
    await qloo.tasteMap([julia.id], CITIES.melbourne.bbox, OFF);
    expect(heat()).toBe(1);
    await qloo.tasteMap([julia.id], { ...CITIES.melbourne.bbox, west: CITIES.melbourne.bbox.west - 1 }, OFF);
    expect(heat()).toBe(2);
  });
});

describe("the research step and the city switch route (offline)", () => {
  async function load() {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
    (await import("@/server/learn/store")).resetLearnStoresForTests();
    (await import("@/server/learn/runs")).clearLearnRunsForTests();
    return { research: await import("@/app/api/playlist/research/route"), playlist: await import("@/app/api/playlist/route"), map: await import("@/app/api/playlist/research/fans-map/route") };
  }
  const req = (method: string, path: string, body?: unknown, cookie?: string) =>
    new Request(`http://localhost:3100/api/playlist${path}`, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

  it("runs after Who your fans are, is saved in the snapshot, and the switch route answers the same shape without a run", async () => {
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

    const api = await m.map.GET(req("GET", "/research/fans-map?city=melbourne", undefined, cookie));
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual(saved.output);
    expect((await m.map.GET(req("GET", "/research/fans-map?city=atlantis", undefined, cookie))).status).toBe(400);
    expect((await m.map.GET(req("GET", "/research/fans-map?city=melbourne"))).status).toBe(404);
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
