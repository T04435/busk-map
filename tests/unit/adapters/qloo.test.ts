import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYNTHETIC_RAW } from "@/server/adapters/qloo/fixtures/synthetic";
import { extractExplanations } from "@/server/adapters/qloo/normalize";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

const area = { south: -37.83, west: 144.94, north: -37.8, east: 144.98 };
const center = { lat: -37.8136, lon: 144.9631 };

async function fresh() {
  vi.resetModules();
  return import("@/server/adapters/qloo");
}

describe("qloo without a key", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "SET_ME"));

  it("serves labelled synthetic data and never calls the network", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([]);
    expect(qloo.qlooMode(LIVE)).toBe("synthetic");

    const resolved = await qloo.resolveArtists(["Paul Kelly", "paul kelly ", "Courtney Barnett"], LIVE);
    expect(resolved.mode).toBe("synthetic");
    // Names are deduplicated case-insensitively.
    expect(resolved.data.map((r) => r.entity?.id)).toEqual(["syn-artist-paul-kelly", "syn-artist-courtney-barnett"]);

    const ids = resolved.data.map((r) => r.entity!.id);
    const heat = await qloo.tasteMap(ids, area, LIVE);
    expect(heat.data).toHaveLength(120);
    expect(heat.data.every((c) => c.affinity >= 0 && c.affinity <= 1)).toBe(true);
    // Deterministic, and different for a different performer.
    expect((await qloo.tasteMap(ids, area, LIVE)).data).toEqual(heat.data);
    expect((await qloo.tasteMap(["syn-other"], area, LIVE)).data).not.toEqual(heat.data);

    const places = await qloo.busyPlaces(ids, center, 1500, "saturday", LIVE);
    expect(places.data.length).toBeGreaterThan(0);
    expect(places.data.every((p) => p.name.startsWith("Synthetic"))).toBe(true);

    expect((await qloo.localArtists(ids, area, 5, LIVE)).data).toHaveLength(5);
    expect(Object.keys((await qloo.artistAffinityAt(ids, center, 300, LIVE)).data)).toEqual(ids);
    expect((await qloo.rising(ids, "2026-09-01", "2026-10-14", LIVE)).data).toHaveLength(2);
    expect((await qloo.crowdProfile(ids, LIVE)).data?.age).toBeDefined();
    expect((await qloo.resolveSpotifyArtists(["abc"], LIVE)).data).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });
});

describe("qloo with a key", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "synthetic-test-key"));

  it("switches to live automatically and sends the key as a header on the hackathon host", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route((u) => u.pathname === "/search", () => json(SYNTHETIC_RAW.search))]);
    expect(qloo.qlooMode(LIVE)).toBe("live");
    expect(qloo.qlooMode(OFFLINE)).toBe("synthetic");

    const result = await qloo.resolveArtists(["Synthetic Artist"], LIVE);
    expect(result.mode).toBe("live");
    expect(result.data[0].entity).toMatchObject({ id: "syn-raw-artist-1", popularity: 0.91, tags: [{ name: "Synthetic" }] });

    const call = calls[0];
    expect(call.url.origin).toBe("https://hackathon.api.qloo.com");
    expect(call.url.searchParams.get("types")).toBe("urn:entity:artist");
    expect(call.url.searchParams.has("api_key")).toBe(false);
    expect((call.init?.headers as Record<string, string>)["X-Api-Key"]).toBe("synthetic-test-key");
    expect(call.init?.method ?? "GET").toBe("GET");
  });

  it("builds heatmap, places and artist requests with the documented parameters", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([
      route((u) => u.searchParams.get("filter.type") === "urn:heatmap", () => json(SYNTHETIC_RAW.heatmap)),
      route((u) => u.searchParams.get("filter.type") === "urn:entity:place", () => json(SYNTHETIC_RAW.places)),
      route((u) => u.searchParams.has("filter.results.entities"), () => json(SYNTHETIC_RAW.insightsArtists)),
      route((u) => u.searchParams.get("filter.type") === "urn:entity:artist", () => json(SYNTHETIC_RAW.insightsArtists)),
    ]);

    const heat = await qloo.tasteMap(["a", "b"], area, LIVE);
    expect(heat.data[0]).toEqual({ lat: -37.81, lon: 144.96, geohash: "r1r0fs", affinity: 0.9, affinityRank: 1, popularity: 0.5 });
    expect(heat.data[1]).toMatchObject({ geohash: null, affinityRank: null, popularity: null });
    const heatParams = calls[0].url.searchParams;
    expect(heatParams.get("signal.interests.entities")).toBe("a,b");
    expect(heatParams.get("filter.location")).toBe("POLYGON((144.94 -37.83, 144.98 -37.83, 144.98 -37.8, 144.94 -37.8, 144.94 -37.83))");

    const places = await qloo.busyPlaces(["a"], center, 800, "saturday", LIVE);
    // The place without coordinates is dropped; geocode coordinates are accepted.
    expect(places.data.map((p) => p.id)).toEqual(["syn-raw-place-1", "syn-raw-place-2"]);
    expect(places.data[0]).toMatchObject({ address: "1 Synthetic Lane", affinity: 0.6, hours: { saturday: expect.any(Array) } });
    const placeParams = calls[1].url.searchParams;
    expect(placeParams.get("filter.location")).toBe("POINT(144.9631 -37.8136)");
    expect(placeParams.get("filter.location.radius")).toBe("800");
    expect(placeParams.get("filter.hours")).toBe("saturday");
    expect(placeParams.get("take")).toBe("50");

    const locals = await qloo.localArtists(["a"], area, 80, LIVE);
    expect(locals.data).toHaveLength(2); // one malformed entity skipped
    expect(locals.data[0].explanation).toEqual([
      { entityId: "syn-raw-artist-1", name: "Synthetic Artist", score: 0.9 },
      { entityId: "syn-raw-artist-3", name: null, score: 0.35 },
    ]);
    expect(calls[2].url.searchParams.get("feature.explainability")).toBe("true");
    expect(calls[2].url.searchParams.get("take")).toBe("50");

    const affinity = await qloo.artistAffinityAt(["syn-raw-local-1", "syn-raw-local-2"], center, 300, LIVE);
    expect(affinity.data).toEqual({ "syn-raw-local-1": 0.88, "syn-raw-local-2": 0.5 });
    expect(calls[3].url.searchParams.get("signal.location.radius")).toBe("300");
  });

  it("reads trending, demographics and spotify lookups", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([
      route((u) => u.pathname === "/v2/trending", () => json(SYNTHETIC_RAW.trending)),
      route((u) => u.searchParams.get("filter.type") === "urn:demographics", () => json(SYNTHETIC_RAW.demographics)),
      route((u) => u.pathname === "/entities", () => json(SYNTHETIC_RAW.search)),
    ]);
    const trend = await qloo.rising(["syn-raw-local-1", "b", "c", "d", "e", "f"], "2026-09-01", "2026-10-14", LIVE);
    expect(trend.data).toContainEqual({ entityId: "syn-raw-local-1", percentDelta: 6, velocity: 3, percentile: 0.6 });
    expect(calls[0].url.searchParams.get("signal.interests.entities")!.split(",")).toHaveLength(5);
    expect(calls[0].url.searchParams.get("filter.start_date")).toBe("2026-09-01");

    const demo = await qloo.crowdProfile(["a", "b"], LIVE);
    expect(demo.data?.age["24_and_younger"]).toBeCloseTo(0.3);
    expect(demo.data?.gender.male).toBeCloseTo(0.05);

    const spotify = await qloo.resolveSpotifyArtists(["sp1", "sp2"], LIVE);
    expect(spotify.data).toHaveLength(2);
    expect(calls[2].url.searchParams.get("external.spotify.ids")).toBe("sp1,sp2");
  });

  it("logs empty results with the parameter names (Qloo ignores invalid params silently)", async () => {
    vi.stubEnv("BUSKMAP_LOG_IN_TESTS", "1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const qloo = await fresh();
    mockFetch([route(() => true, () => json(SYNTHETIC_RAW.heatmapEmpty))]);
    const result = await qloo.tasteMap(["a"], area, LIVE);
    expect(result).toMatchObject({ mode: "live", data: [] });
    const line = JSON.parse(warn.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "warn", path: "/v2/insights", filterType: "urn:heatmap" });
    expect(line.params).toEqual(["filter.type", "signal.interests.entities", "filter.location"]);
    expect(JSON.stringify(line)).not.toContain("synthetic-test-key");
  });

  it("falls back with a reason when Qloo is down", async () => {
    const qloo = await fresh();
    mockFetch([route(() => true, () => json({ error: "down" }, 503))]);
    expect(await qloo.tasteMap(["a"], area, LIVE)).toMatchObject({ mode: "fallback", reason: "http", data: [] });
    expect(await qloo.resolveArtists(["x"], LIVE)).toMatchObject({ mode: "fallback", data: [{ query: "x", entity: null }] });
    expect(await qloo.crowdProfile(["x"], LIVE)).toMatchObject({ mode: "fallback", data: null });
  });

  it("keeps resolved artists when only some searches fail, and handles no match", async () => {
    const qloo = await fresh();
    mockFetch([
      route((u) => u.searchParams.get("query") === "ok", () => json(SYNTHETIC_RAW.search)),
      route((u) => u.searchParams.get("query") === "none", () => json({ results: [] })),
      route(() => true, () => json({}, 500)),
    ]);
    const result = await qloo.resolveArtists(["ok", "none", "broken"], LIVE);
    expect(result.mode).toBe("live");
    expect(result.data.map((r) => r.entity?.id ?? null)).toEqual(["syn-raw-artist-1", null, null]);
  });

  it("returns no demographics when Qloo has none", async () => {
    const qloo = await fresh();
    mockFetch([route(() => true, () => json({ results: { demographics: [] } }))]);
    expect((await qloo.crowdProfile(["a"], LIVE)).data).toBeNull();
  });
});

describe("extractExplanations", () => {
  it("finds id and score pairs at any depth and ignores junk", () => {
    expect(extractExplanations({ a: { b: [{ id: "x", score: 0.5 }, { id: "y", weight: 0.2 }, { id: "z" }] } })).toEqual([
      { entityId: "x", name: null, score: 0.5 },
      { entityId: "y", name: null, score: 0.2 },
    ]);
    expect(extractExplanations(null)).toEqual([]);
    expect(extractExplanations("text")).toEqual([]);
    expect(extractExplanations({ a: { b: { c: { d: { e: { f: { id: "deep", score: 1 } } } } } } })).toEqual([]);
  });
});

describe("qloo trending attribution", () => {
  it("attributes id-less rows only when one entity was asked about, keeping the latest week", async () => {
    vi.stubEnv("QLOO_API_KEY", "synthetic-test-key");
    const qloo = await fresh();
    mockFetch([
      route(() => true, () =>
        json({ results: { trending: [{ date: "2026-10-08", population_percent_delta: 5 }, { date: "2026-10-01", population_percent_delta: 1 }] } }),
      ),
    ]);
    const result = await qloo.rising(["only"], "2026-09-01", "2026-10-14", LIVE);
    expect(result.data).toEqual([{ entityId: "only", percentDelta: 5, velocity: null, percentile: null }]);
  });
});
