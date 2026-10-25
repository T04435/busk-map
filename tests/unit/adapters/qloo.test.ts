import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractExplanations } from "@/server/adapters/qloo/normalize";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

// Small synthetic payloads in the shapes live Qloo returned on 2026-10-15. Not Qloo data.
const SYNTHETIC_RAW = {
  search: {
    results: [
      {
        entity_id: "syn-raw-artist-1",
        name: "Synthetic Artist",
        types: ["urn:entity:artist"],
        popularity: 0.91,
        properties: { external: { spotify: { id: "SPOTIFYID0000000000001" }, lastfm: { id: "synthetic%20artist", listeners: 12345, scrobbles: 99999 } } },
        tags: [
          { name: " Synthetic", tag_id: "urn:tag:genre:music:synthetic", type: "urn:tag:genre:music", value: "urn:tag:genre:music:synthetic" },
          { name: "No id", type: "urn:tag:genre:music" },
        ],
      },
      { entity_id: "syn-raw-artist-2", name: "Synthetic Artist Tribute", popularity: 0.2 },
    ],
  },
  insightsArtists: {
    results: {
      entities: [
        {
          entity_id: "syn-raw-local-1",
          name: "Synthetic Local",
          popularity: 0.7,
          query: { affinity: 0.88, explainability: { "signal.interests.entities": [{ entity_id: "syn-raw-artist-1", name: "Synthetic Artist", score: 0.9 }, { entity_id: "syn-raw-artist-3", score: 0.35 }] } },
        },
        { entity_id: "syn-raw-local-2", name: "Synthetic Local Two", external: { lastfm: [{ id: "x", listeners: 777 }] }, query: { affinity: 0.5 } },
        { name: "missing id" },
      ],
    },
    query: {
      geospatial: { panel_size: { context: 100, target: 10 } },
      explainability: {
        "signal.interests.entities": {
          effect_on_top3_recs: [{ entity_id: "syn-raw-artist-1", avg_score: 0.8 }, { entity_id: "syn-raw-artist-3", avg_score: 0.2 }],
          effect_on_top5_recs: [{ entity_id: "syn-raw-artist-1", avg_score: 0.7 }],
          effect_on_top10_recs: [{ entity_id: "syn-raw-artist-1", avg_score: 0.6 }],
          effect_on_all_recs: [{ entity_id: "syn-raw-artist-1", avg_score: 0.5 }],
        },
      },
    },
  },
  places: {
    results: {
      entities: [
        { entity_id: "syn-raw-place-1", name: "Synthetic Bar", popularity: 0.8, location: { lat: -37.8158, lon: 144.9653 }, properties: { address: "1 Synthetic Lane", hours: { saturday: [{ opens: "T16:00:00", closed: false, closes: "T02:00:00" }], sunday: [{ opens: null, closed: true, closes: null }] } }, query: { affinity: 0.6, distance: 120.5 } },
        { entity_id: "syn-raw-place-2", name: "Synthetic Cafe", tags: null, properties: { address: null, geocode: { latitude: -37.81, longitude: 144.96 } } },
        { entity_id: "syn-raw-place-3", name: "Synthetic Nowhere" },
      ],
    },
  },
  heatmap: {
    results: {
      heatmap: [
        { location: { latitude: -37.81, longitude: 144.96, geohash: "r1r0fs1" }, query: { affinity: 0.9, affinity_rank: 1, popularity: 0.5, entity_artist_affinity: 0.9, entity_artist_affinity_rank: 1 } },
        { location: { latitude: -37.82, longitude: 144.95 }, query: { affinity: 0.2 } },
      ],
    },
  },
  heatmapEmpty: { results: { heatmap: [] } },
  trending: {
    results: {
      trending: [
        { date: "2026-10-08", population_percentile: 0.6, population_rank: "4000", population_rank_velocity: 3, velocity_fold_change: 1.2, population_percent_delta: 6 },
        { date: "2026-10-01", population_percentile: 0.5, population_rank: "4800", population_rank_velocity: 1, velocity_fold_change: 1, population_percent_delta: 2 },
      ],
    },
  },
  demographics: {
    results: {
      demographics: [
        { entity_id: "a", query: { age: { "24_and_younger": 0.2, "55_and_older": -0.1 }, gender: { male: 0.1, female: -0.1 } } },
        { entity_id: "b", query: { age: { "24_and_younger": 0.4 } } },
      ],
    },
  },
};

const area = { south: -37.83, west: 144.94, north: -37.8, east: 144.98 };
const center = { lat: -37.8136, lon: 144.9631 };

async function fresh() {
  vi.resetModules();
  return import("@/server/adapters/qloo");
}

describe("qloo without a key", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "SET_ME"));

  it("runs the real client against the local mock, labelled synthetic, with no network", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([]);
    expect(qloo.qlooMode(LIVE)).toBe("synthetic");

    const resolved = await qloo.resolveArtists(["Paul Kelly", "paul kelly ", "Courtney Barnett"], LIVE);
    expect(resolved.mode).toBe("synthetic");
    // Names are deduplicated case-insensitively; mock ids start with 4D4F434B ("MOCK").
    expect(resolved.data.map((r) => r.entity?.name)).toEqual(["Paul Kelly", "Courtney Barnett"]);
    expect(resolved.data.every((r) => r.entity!.id.startsWith("4D4F434B-"))).toBe(true);

    const ids = resolved.data.map((r) => r.entity!.id);
    const heat = await qloo.tasteMap(ids, area, LIVE);
    expect(heat.data.length).toBeGreaterThan(10);
    // Geohash precision 7, as live Qloo returns for a city-centre polygon.
    expect(heat.data.every((c) => c.affinity >= 0 && c.affinity <= 1 && c.geohash?.length === 7)).toBe(true);
    expect((await qloo.tasteMap(ids, area, LIVE)).data).toEqual(heat.data);

    const places = await qloo.busyPlaces(ids, center, 1500, "saturday", LIVE);
    expect(places.data.length).toBe(50);
    // Live hours shape: lowercase weekdays with opens/closes/closed.
    expect(Object.keys(places.data[0].hours!)).toEqual(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
    expect(places.data[0].hours!.saturday).toEqual([expect.objectContaining({ opens: expect.stringMatching(/^T\d{2}:\d{2}:\d{2}$/), closed: false })]);

    const locals = await qloo.localArtists(ids, area, 5, LIVE);
    expect(locals.data.artists).toHaveLength(5);
    expect(locals.data.artists[0].explanation.length).toBeGreaterThan(0);
    expect(locals.data.artists[0].lastfmListeners).toBeGreaterThan(0);
    expect(locals.data.impact.map((i) => i.entityId).sort()).toEqual([...ids].sort());
    expect(Object.keys((await qloo.artistAffinityAt(ids, center, 300, LIVE)).data).sort()).toEqual([...ids].sort());
    const localIds = locals.data.artists.map((a) => a.id);
    // Like live, the mock's trending is empty for recent weeks; the latest window with data is found by probing back.
    expect((await qloo.rising(localIds, "2026-09-01", "2026-10-14", LIVE)).data).toEqual([]);
    const window = (await qloo.trendingWindow(localIds[0], "2026-10-15", LIVE)).data;
    expect(window).toEqual({ start: "2026-03-04", end: "2026-04-15" });
    const trend = await qloo.rising(localIds, window!.start, window!.end, LIVE);
    expect(trend.data).toHaveLength(5);
    expect(trend.data.every((t) => t.percentile !== null && t.percentile > 1 && t.percentile <= 100)).toBe(true);
    expect(new Set(trend.data.map((t) => t.windowChange)).size).toBeGreaterThan(1);
    expect((await qloo.crowdProfile(ids, LIVE)).data?.age).toBeDefined();
    expect((await qloo.crowdTags(ids, center, 400, 5, LIVE)).data).toHaveLength(5);
    const contrast = (await qloo.compareGenres(ids, localIds, LIVE)).data;
    expect(contrast.length).toBeGreaterThan(0);
    expect(contrast.every((c) => c.a >= 0 && c.a <= 1 && c.b >= 0 && c.b <= 1 && c.name === c.name.trim())).toBe(true);
    expect((await qloo.resolveSpotifyArtists(["not-a-known-id"], LIVE)).data).toEqual([]);
    // The mock implements Qloo's external Spotify id lookup.
    const { mockSpotifyId } = await import("@/server/qloo-mock/catalog");
    const byId = await qloo.resolveArtists(["Missy"], LIVE, [{ name: "Missy", id: mockSpotifyId("Missy Higgins") }]);
    expect(byId.data[0].entity?.name).toBe("Missy Higgins");
    expect(calls).toHaveLength(0);
  });

  it("uses the mock when QLOO_MOCK=1 even with a key", async () => {
    vi.stubEnv("QLOO_API_KEY", "synthetic-test-key");
    vi.stubEnv("QLOO_MOCK", "1");
    const qloo = await fresh();
    const { calls } = mockFetch([]);
    expect(qloo.qlooMode(LIVE)).toBe("synthetic");
    expect((await qloo.resolveArtists(["Hiatus Kaiyote"], LIVE)).mode).toBe("synthetic");
    expect(calls).toHaveLength(0);
  });

  it("still honours injected faults", async () => {
    const qloo = await fresh();
    expect(await qloo.tasteMap(["a"], area, { offline: true, faults: ["qloo"] })).toMatchObject({ mode: "fallback", reason: "fault_injected" });
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
    // Live /search tags carry `tag_id` (names trimmed; a tag without an id is dropped) and Last.fm listeners.
    expect(result.data[0].entity).toMatchObject({ id: "syn-raw-artist-1", popularity: 0.91, lastfmListeners: 12345, tags: [{ id: "urn:tag:genre:music:synthetic", name: "Synthetic" }] });
    expect(result.data[0].entity!.tags).toHaveLength(1);

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
    expect(heat.data[0]).toEqual({ lat: -37.81, lon: 144.96, geohash: "r1r0fs1", affinity: 0.9, affinityRank: 1, popularity: 0.5 });
    expect(heat.data[1]).toMatchObject({ geohash: null, affinityRank: null, popularity: null });
    const heatParams = calls[0].url.searchParams;
    expect(heatParams.get("signal.interests.entities")).toBe("a,b");
    expect(heatParams.get("filter.location")).toBe("POLYGON((144.94 -37.83, 144.98 -37.83, 144.98 -37.8, 144.94 -37.8, 144.94 -37.83))");

    const places = await qloo.busyPlaces(["a"], center, 800, "saturday", LIVE);
    // The place without coordinates is dropped; geocode coordinates are accepted.
    expect(places.data.map((p) => p.id)).toEqual(["syn-raw-place-1", "syn-raw-place-2"]);
    expect(places.data[0]).toMatchObject({ address: "1 Synthetic Lane", affinity: 0.6, hours: { saturday: expect.any(Array) } });
    expect(places.data[1]).toMatchObject({ address: null, tags: [] });
    const placeParams = calls[1].url.searchParams;
    expect(placeParams.get("filter.location")).toBe("POINT(144.9631 -37.8136)");
    expect(placeParams.get("filter.location.radius")).toBe("800");
    expect(placeParams.get("filter.hours")).toBe("saturday");
    expect(placeParams.get("take")).toBe("50");

    const locals = await qloo.localArtists(["a"], area, 80, LIVE);
    expect(locals.data.artists).toHaveLength(2); // one malformed entity skipped
    expect(locals.data.artists[1].lastfmListeners).toBe(777);
    expect(locals.data.impact).toEqual([
      { entityId: "syn-raw-artist-1", top3: 0.8, top5: 0.7, top10: 0.6, all: 0.5 },
      { entityId: "syn-raw-artist-3", top3: 0.2, top5: null, top10: null, all: null },
    ]);
    expect(locals.data.artists[0].explanation).toEqual([
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
    // One request per artist (the rows carry no entity id), at most five.
    expect(trend.data).toHaveLength(5);
    // Percentiles arrive as 0–1 fractions and are reported in points (0–100).
    expect(trend.data[0]).toEqual({ entityId: "syn-raw-local-1", percentDelta: 6, velocity: 3, percentile: 60, windowChange: 10, series: [50, 60] });
    const trendCalls = calls.filter((c) => c.url.pathname === "/v2/trending");
    expect(trendCalls.map((c) => c.url.searchParams.get("signal.interests.entities"))).toEqual(["syn-raw-local-1", "b", "c", "d", "e"]);
    expect(trendCalls[0].url.searchParams.get("filter.start_date")).toBe("2026-09-01");

    const demo = await qloo.crowdProfile(["a", "b"], LIVE);
    expect(demo.data?.age["24_and_younger"]).toBeCloseTo(0.3);
    expect(demo.data?.gender.male).toBeCloseTo(0.05);

    const spotify = await qloo.resolveSpotifyArtists(["sp1", "sp2"], LIVE);
    expect(spotify.data).toHaveLength(2);
    expect(calls.find((c) => c.url.pathname === "/entities")!.url.searchParams.get("external.spotify.ids")).toBe("sp1,sp2");
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
      route((u) => u.searchParams.get("query") === "none", () => json({ code: 404, reason: "Not Found", message: "No results" }, 404)),
      route(() => true, () => json({}, 500)),
    ]);
    const result = await qloo.resolveArtists(["ok", "none", "broken"], LIVE);
    expect(result.mode).toBe("live");
    expect(result.data.map((r) => r.entity?.id ?? null)).toEqual(["syn-raw-artist-1", null, null]);
  });

  it("resolves picked artists by Spotify id first, falling back to the name", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([
      route((u) => u.pathname === "/entities" && u.searchParams.get("external.spotify.ids") === "SPOTIFYID0000000000001", () =>
        json({ results: [{ entity_id: "syn-raw-by-id", name: "Synthetic Artist" }] }),
      ),
      route((u) => u.pathname === "/entities" && u.searchParams.get("external.spotify.ids") === "SPOTIFYID0000000000002", () =>
        json({ code: 404, reason: "Not Found", message: "No results" }, 404),
      ),
      route((u) => u.pathname === "/entities", () => json({}, 500)),
      route((u) => u.pathname === "/search", () => json(SYNTHETIC_RAW.search)),
    ]);
    const result = await qloo.resolveArtists(["Synthetic Artist", "Unknown To Qloo", "Broken Id", "Typed Only"], LIVE, [
      { name: "synthetic artist", id: "SPOTIFYID0000000000001" },
      { name: "Unknown To Qloo", id: "SPOTIFYID0000000000002" },
      { name: "Broken Id", id: "SPOTIFYID0000000000003" },
    ]);
    expect(result.data.map((r) => r.entity?.id)).toEqual(["syn-raw-by-id", "syn-raw-artist-1", "syn-raw-artist-1", "syn-raw-artist-1"]);
    // The id hit needs no name search; the other three fall back to it.
    expect(calls.filter((c) => c.url.pathname === "/search").map((c) => c.url.searchParams.get("query")).sort()).toEqual(["Broken Id", "Typed Only", "Unknown To Qloo"]);
  });

  it("returns no demographics when Qloo has none", async () => {
    const qloo = await fresh();
    mockFetch([route(() => true, () => json({ results: { demographics: [] } }))]);
    expect((await qloo.crowdProfile(["a"], LIVE)).data).toBeNull();
  });
});

describe("qloo never sends a request with nothing to signal", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "synthetic-test-key"));

  // Live Qloo answers such a request with 400 "at least one valid signal or filter is required for entity insights".
  const refusal = () => json({ errors: [{ message: "at least one valid signal or filter is required for entity insights" }] }, 400);
  const blank = ["", " ", "a,b", "has space"];

  it("skips every builder with empty or malformed signal inputs: no request, empty data, a typed no_signal result (not an outage)", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(() => true, refusal)]);
    const skipped = [
      ["tasteMap", await qloo.tasteMap([], area, LIVE), []],
      ["tasteMap (malformed ids, no tags)", await qloo.tasteMap(blank, area, LIVE, undefined, ["rock", " "]), []],
      ["busyPlaces", await qloo.busyPlaces([], center, 400, "saturday", LIVE), []],
      ["tasteArtists", await qloo.tasteArtists([], 10, LIVE), { artists: [], impact: [] }],
      ["artistAffinityAt", await qloo.artistAffinityAt([], center, 400, LIVE), {}],
      ["tasteMatch (no signal)", await qloo.tasteMatch(["x"], [], LIVE), {}],
      ["tasteMatch (no results)", await qloo.tasteMatch([], ["x"], LIVE), {}],
      ["crowdProfile", await qloo.crowdProfile(blank, LIVE), null],
      ["actGenres", await qloo.actGenres([], 6, LIVE), []],
      ["compareGenres", await qloo.compareGenres([], ["b"], LIVE), []],
      ["sceneArtists", await qloo.sceneArtists([" "], area, 20, LIVE), []],
      ["tagArtists", await qloo.tagArtists(["not-a-tag"], 10, LIVE), []],
      ["trendingWindow", await qloo.trendingWindow(" ", "2026-10-15", LIVE), null],
    ] as const;
    for (const [name, result, empty] of skipped) {
      expect({ name, mode: result.mode, reason: result.reason, data: result.data }).toEqual({ name, mode: "live", reason: "no_signal", data: empty });
      expect(qloo.noSignal(result)).toBe(true);
    }
    expect(calls).toHaveLength(0);
  });

  it("sends a call whose only signal is a location or the act's genres, and drops malformed entity ids", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([
      route((u) => u.searchParams.get("filter.type") === "urn:heatmap", () => json(SYNTHETIC_RAW.heatmap)),
      route((u) => u.searchParams.get("filter.type") === "urn:tag", () => json({ success: true, results: { tags: [] } })),
      route((u) => u.searchParams.get("filter.type") === "urn:entity:artist", () => json(SYNTHETIC_RAW.insightsArtists)),
    ]);
    expect((await qloo.tasteMap([" "], area, LIVE, undefined, ["urn:tag:genre:music:fado"])).mode).toBe("live");
    expect(calls[0].url.searchParams.has("signal.interests.entities")).toBe(false);
    expect(calls[0].url.searchParams.get("signal.interests.tags")).toBe("urn:tag:genre:music:fado");
    // The area (local artists) and the point (crowd genres) are location signals on their own.
    expect((await qloo.localArtists([], area, 10, LIVE)).reason).toBeUndefined();
    expect((await qloo.crowdTags(["", "ok-id"], center, 400, 6, LIVE)).reason).toBeUndefined();
    expect(calls[2].url.searchParams.get("signal.interests.entities")).toBe("ok-id");
    expect(calls).toHaveLength(3);
  });

  it("asks for the global-pop set with a popularity filter, never with filter.type alone", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route((u) => u.searchParams.get("filter.type") === "urn:entity:artist", () => json(SYNTHETIC_RAW.insightsArtists))]);
    await qloo.globalArtists(20, LIVE);
    const params = calls[0].url.searchParams;
    expect(params.get("filter.popularity.min")).toBe("0.9");
    expect([...params.keys()].sort()).toEqual(["filter.popularity.min", "filter.type", "take"]);
  });

  it("recovers the no_signal kind from an error that lost its class in the cache", async () => {
    const { AdapterError, errorKindOf } = await import("@/server/adapters/core");
    expect(errorKindOf(new Error("Qloo heatmap skipped: no valid signal or filter to send"))).toBe("no_signal");
    expect(errorKindOf(new AdapterError("qloo", "no_signal", "x"))).toBe("no_signal");
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
  it("keeps the newest week and ignores rows attributed to another entity", async () => {
    vi.stubEnv("QLOO_API_KEY", "synthetic-test-key");
    const qloo = await fresh();
    mockFetch([
      route(() => true, () =>
        json({ results: { trending: [{ date: "2026-10-01", population_percent_delta: 1 }, { date: "2026-10-08", population_percent_delta: 5 }, { entity_id: "other", date: "2026-10-15", population_percent_delta: 9 }] } }),
      ),
    ]);
    const result = await qloo.rising(["only"], "2026-09-01", "2026-10-14", LIVE);
    expect(result.data).toEqual([{ entityId: "only", percentDelta: 5, velocity: null, percentile: null, windowChange: null, series: [] }]);
  });

  it("returns nothing for an empty series and fails only when every request fails", async () => {
    vi.stubEnv("QLOO_API_KEY", "synthetic-test-key");
    const qloo = await fresh();
    mockFetch([route((u) => u.searchParams.get("signal.interests.entities") === "empty", () => json({ results: { trending: [] } })), route(() => true, () => json({}, 500))]);
    expect(await qloo.rising(["empty", "broken"], "2026-09-01", "2026-10-14", LIVE)).toMatchObject({ mode: "live", data: [] });
    expect(await qloo.rising(["broken"], "2026-09-01", "2026-10-14", LIVE)).toMatchObject({ mode: "fallback", data: [] });
  });
});

describe("qloo live behaviour (synthetic payloads in the live shapes)", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "synthetic-test-key"));

  it("retries a 429 after a pause, then gives up with rate_limited", async () => {
    const qloo = await fresh();
    let first = true;
    const { calls } = mockFetch([
      route((u) => u.searchParams.get("query") === "busy", () => {
        if (!first) return json(SYNTHETIC_RAW.search);
        first = false;
        return json({ error_msg: "Rate limit exceeded" }, 429);
      }),
      route(() => true, () => json({ error_msg: "Rate limit exceeded" }, 429)),
    ]);
    const ok = await qloo.resolveArtists(["busy"], LIVE);
    expect(ok.data[0].entity?.id).toBe("syn-raw-artist-1");
    expect(calls).toHaveLength(2);
    const failed = await qloo.tasteMap(["a"], area, LIVE);
    expect(failed).toMatchObject({ mode: "fallback", reason: "rate_limited" });
    // One try plus two retries.
    expect(calls).toHaveLength(5);
  }, 10_000);

  it("paces live requests to a few a second", async () => {
    const { pace } = await import("@/server/adapters/qloo/client");
    const started: number[] = [];
    await Promise.all(Array.from({ length: 5 }, () => pace(2).then(() => started.push(Date.now()))));
    // Five starts at two a second span at least two seconds.
    expect(started[4] - started[0]).toBeGreaterThanOrEqual(1_900);
  }, 10_000);

  it("reads compare's per-group tag counts as genre shares", async () => {
    const qloo = await fresh();
    const tag = (id: string, name: string, subtype: string, count: string) => ({ tag_id: id, name, type: "urn:tag", subtype, entity_id: `e-${id}`, popularity: 0.5, query: { count } });
    const { calls } = mockFetch([
      route((u) => u.pathname === "/v2/analysis/compare", () =>
        json({
          duration: 10,
          results: {
            tags: [{ ...tag("urn:tag:genre:music:folk", "Folk", "urn:tag:genre:music", "1"), query: { score: 0.9, "a.signal.interests.entities": [], "b.signal.interests.entities": [] } }],
            a: [tag("urn:tag:genre:music:folk", " Folk", "urn:tag:genre:music", "2"), tag("urn:tag:audience:qloo:indie", "Indie", "urn:tag:audience:qloo", "2"), tag("urn:tag:genre:music:jazz", "Jazz", "urn:tag:genre:music", "1")],
            b: [tag("urn:tag:genre:music:folk", "Folk", "urn:tag:genre:music", "1"), tag("urn:tag:genre:music:dance", "Dance", "urn:tag:genre:music", "4")],
            matchEntities: [],
          },
        }),
      ),
    ]);
    const result = await qloo.compareGenres(["a1", "a2"], ["b1", "b2", "b3", "b4"], LIVE);
    expect(result.data).toEqual([
      { id: "urn:tag:genre:music:folk", name: "Folk", a: 1, b: 0.25 },
      { id: "urn:tag:genre:music:jazz", name: "Jazz", a: 0.5, b: 0 },
      { id: "urn:tag:genre:music:dance", name: "Dance", a: 0, b: 1 },
    ]);
    expect(calls[0].url.searchParams.has("filter.subtype")).toBe(false);
  });

  it("local scene: sends only valid tag ids, skips the call with none, and retries the strongest tag when Qloo refuses the list", async () => {
    const qloo = await fresh();
    const area = { south: -37.8265, west: 144.9365, north: -37.7985, east: 144.9845 };
    const refusal = () => json({ errors: [{ message: "at least one valid signal or filter is required for entity insights" }] }, 400);
    const row = (id: string) => ({ entity_id: id, name: `Act ${id}`, type: "urn:entity:artist" });
    const { calls } = mockFetch([
      route((u) => u.searchParams.get("signal.interests.tags")?.includes(",") === true, refusal),
      route((u) => u.pathname === "/v2/insights", () => json({ success: true, results: { entities: [row("s1")] } })),
    ]);
    // Nothing valid to send: no request at all.
    expect((await qloo.sceneArtists([" ", "rock", "a,b"], area, 20, LIVE)).data).toEqual([]);
    expect(calls).toHaveLength(0);
    // A list Qloo refuses falls back to the strongest handle alone.
    const result = await qloo.sceneArtists(["urn:tag:genre:music:folk", "urn:tag:genre:music:jazz"], area, 20, LIVE);
    expect(result.data.map((a) => a.id)).toEqual(["s1"]);
    expect(calls.map((c) => c.url.searchParams.get("signal.interests.tags"))).toEqual(["urn:tag:genre:music:folk,urn:tag:genre:music:jazz", "urn:tag:genre:music:folk"]);
  });

  it("finds the latest trending window with data, a quarter at a time, up to a year back", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([
      route((u) => (u.searchParams.get("filter.end_date") ?? "") > "2026-05-31", () => json({ success: true, results: { trending: [] }, duration: 5 })),
      route(() => true, () => json({ success: true, results: { trending: [{ date: "2026-04-10", population_percentile: 0.11, population_rank: "50168", population_rank_velocity: 0, velocity_fold_change: 0, population_percent_delta: 0 }] } })),
    ]);
    expect((await qloo.trendingWindow("probe", "2026-10-15", LIVE)).data).toEqual({ start: "2026-03-04", end: "2026-04-15" });
    expect(calls.map((c) => c.url.searchParams.get("filter.end_date"))).toEqual(["2026-10-14", "2026-07-15", "2026-04-15"]);

    mockFetch([route(() => true, () => json({ success: true, results: { trending: [] } }))]);
    const none = await (await fresh()).trendingWindow("probe", "2026-10-15", LIVE);
    expect(none).toMatchObject({ mode: "live", data: null });
  });
});

describe("toImpact", () => {
  it("is empty without the aggregate", async () => {
    const { toImpact } = await import("@/server/adapters/qloo/normalize");
    expect(toImpact(undefined)).toEqual([]);
    expect(toImpact({})).toEqual([]);
  });
});
