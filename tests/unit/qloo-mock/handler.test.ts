import { describe, expect, it } from "vitest";
import { wktPolygon } from "@/lib/geo";
import { CATALOG } from "@/server/qloo-mock/catalog";
import { handleQlooMock } from "@/server/qloo-mock/handler";
import { qlooMockFetch } from "@/server/qloo-mock/fetch";

const CBD = { south: -37.8265, west: 144.9365, north: -37.7985, east: 144.9845 };

async function call(path: string, params: Record<string, string> = {}, init: RequestInit = { headers: { "X-Api-Key": "test" } }) {
  const res = await handleQlooMock(new Request(`https://qloo-mock.invalid${path}?${new URLSearchParams(params)}`, init));
  return { status: res.status, body: await res.json() };
}

async function idsFor(names: string[]): Promise<string> {
  const ids: string[] = [];
  for (const name of names) ids.push((await call("/search", { query: name, types: "urn:entity:artist", take: "1" })).body.results[0].entity_id);
  return ids.join(",");
}

const FOLK = ["Angus & Julia Stone", "The Paper Kites", "Simon & Garfunkel", "Mumford & Sons"];
const SOUL = ["Stevie Wonder", "Amy Winehouse", "Hiatus Kaiyote", "Kamasi Washington"];
const SONGWRITER = ["Paul Kelly", "Courtney Barnett", "Vance Joy", "Missy Higgins"];

const heat = async (names: string[]) =>
  (await call("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": await idsFor(names), "filter.location": wktPolygon(CBD) })).body.results.heatmap as {
    location: { latitude: number; longitude: number; geohash: string };
    query: { affinity: number; affinity_rank: number; popularity: number };
  }[];

describe("qloo mock: HTTP contract", () => {
  it("requires the X-Api-Key header, GET, and a known path", async () => {
    expect(await call("/v2/insights", { "filter.type": "urn:entity:artist" }, {})).toEqual({ status: 401, body: { message: "No API key found in request" } });
    expect((await call("/v2/insights", {}, { method: "POST", headers: { "X-Api-Key": "k" } })).status).toBe(404);
    expect(await call("/v2/insights/search")).toMatchObject({ status: 404, body: { code: 404, message: "No path matching request parameters" } });
    expect(await call("/")).toMatchObject({ status: 200, body: { mock: true } });
  });

  it("validates filter.type and take like the docs describe", async () => {
    expect(await call("/v2/insights")).toMatchObject({ status: 400, body: { code: 400, reason: "Bad Request" } });
    expect(await call("/v2/insights", { "filter.type": "urn:entity:music" })).toMatchObject({ status: 403, body: { message: "You do not have permission to access urn:entity:music" } });
    expect((await call("/v2/insights", { "filter.type": "nonsense" })).status).toBe(400);
    expect(await call("/v2/insights", { "filter.type": "urn:entity:movie" })).toMatchObject({ status: 200, body: { success: true, results: { entities: [] } } });
    expect((await call("/v2/insights", { "filter.type": "urn:entity:artist", take: "51" })).status).toBe(400);
    expect((await call("/v2/insights", { "filter.type": "urn:entity:artist", take: "0" })).status).toBe(400);
  });

  it("silently ignores parameters that are not valid for the filter.type", async () => {
    const ids = await idsFor(SOUL);
    const base = { "filter.type": "urn:entity:artist", "signal.interests.entities": ids, take: "10" };
    const plain = await call("/v2/insights", base);
    const noisy = await call("/v2/insights", { ...base, "filter.hours": "monday", "filter.location": "POINT(144.96 -37.81)", "made.up": "1" });
    expect(noisy.status).toBe(200);
    expect(noisy.body.results).toEqual(plain.body.results);
  });

  it("rejects requests whose only signal is an invalid tag", async () => {
    expect(await call("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.tags": "urn:tag:not:real" })).toMatchObject({
      status: 400,
      body: { message: "at least one valid signal or filter is required" },
    });
  });

  it("is deterministic", async () => {
    expect(await heat(FOLK)).toEqual(await heat(FOLK));
  });

  it("answers through the in-process fetch", async () => {
    const res = await qlooMockFetch("https://qloo-mock.invalid/search?query=Paul%20Kelly", { headers: { "X-Api-Key": "k" } });
    expect((await res.json()).results[0].name).toBe("Paul Kelly");
  });
});

describe("qloo mock: /search and /entities", () => {
  it("finds catalogue artists by name and aka, and invents a profile for unknown names", async () => {
    const exact = await call("/search", { query: "boy and bear", types: "urn:entity:artist" });
    expect(exact.body.results[0]).toMatchObject({ name: "Boy & Bear", subtype: "urn:entity:artist", entity_id: expect.stringMatching(/^4D4F434B-/) });
    expect(exact.body.results[0].tags[0]).toMatchObject({ type: "urn:tag:genre:music" });
    const invented = await call("/search", { query: "Totally Unknown Busker", types: "urn:entity:artist" });
    expect(invented.body.results[0]).toMatchObject({ name: "Totally Unknown Busker", disambiguation: "Artist (mock, generated profile)" });
    expect((await call("/search", {})).status).toBe(400);
    expect(await call("/search", { query: "zzzz-nothing", types: "urn:entity:place" })).toMatchObject({ status: 404, body: { message: "No results" } });
    expect((await call("/search", { query: "Queen Victoria Market", types: "urn:entity:place" })).body.results[0].subtype).toBe("urn:entity:place");
  });

  it("looks up entities by Qloo id and by Spotify id", async () => {
    const [artist] = CATALOG;
    expect((await call("/entities", { entity_ids: artist.id })).body.results[0].name).toBe(artist.name);
    expect((await call("/entities", { "external.spotify.ids": artist.spotifyId })).body.results[0].entity_id).toBe(artist.id);
    expect(await call("/entities", {})).toMatchObject({ status: 400, body: { message: "entity_ids must be specified." } });
    expect((await call("/entities", { "external.spotify.ids": "nope" })).status).toBe(404);
  });
});

describe("qloo mock: taste field", () => {
  it("returns geohash cells inside the polygon, best first, with the documented fields", async () => {
    const cells = await heat(SONGWRITER);
    expect(cells.length).toBeGreaterThan(15);
    expect(cells[0].query.affinity).toBe(1);
    expect(cells.every((c, i) => i === 0 || c.query.affinity <= cells[i - 1].query.affinity)).toBe(true);
    expect(cells.every((c) => c.location.geohash.length === 6 && c.query.popularity >= 0 && c.query.popularity <= 1)).toBe(true);
  });

  it("puts folk, soul and singer-songwriter crowds in clearly different places", async () => {
    const top = async (names: string[]) => (await heat(names)).slice(0, 3).map((c) => c.location.geohash);
    const [folk, soul, songwriter] = await Promise.all([top(FOLK), top(SOUL), top(SONGWRITER)]);
    expect(folk[0]).not.toBe(soul[0]);
    expect(soul[0]).not.toBe(songwriter[0]);
    expect(folk[0]).not.toBe(songwriter[0]);
    expect(soul.filter((g) => folk.includes(g))).toEqual([]);
  });

  it("accepts a locality query and reports the resolved locality", async () => {
    const res = await call("/v2/insights", { "filter.type": "urn:heatmap", "filter.location.query": "Melbourne", "signal.interests.tags": "urn:tag:genre:music:jazz" });
    expect(res.body.results.heatmap.length).toBeGreaterThan(0);
    expect(res.body.query.localities.filter).toMatchObject({ name: "Melbourne", subtype: "urn:entity:locality" });
    expect((await call("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.tags": "urn:tag:genre:music:jazz" })).status).toBe(400);
    expect((await call("/v2/insights", { "filter.type": "urn:heatmap", "filter.location": "garbage", "signal.interests.tags": "urn:tag:genre:music:jazz" })).body.results.heatmap).toEqual([]);
    expect((await call("/v2/insights", { "filter.type": "urn:heatmap", "filter.location": "POINT(151.2 -33.86)", "filter.location.radius": "2000", "signal.interests.tags": "urn:tag:genre:music:jazz" })).body.results.heatmap).toEqual([]);
  });
});

describe("qloo mock: places and artists", () => {
  it("filters places by location, radius and opening day, ranked by fit, with distance", async () => {
    const ids = await idsFor(FOLK);
    const res = await call("/v2/insights", {
      "filter.type": "urn:entity:place",
      "signal.interests.entities": ids,
      "filter.location": "POINT(144.9631 -37.8136)",
      "filter.location.radius": "800",
      "filter.hours": "sunday",
      "feature.explainability": "true",
      take: "50",
    });
    const places = res.body.results.entities;
    expect(places.length).toBeGreaterThan(5);
    expect(places.every((p: { query: { distance: number } }) => p.query.distance <= 800)).toBe(true);
    expect(places.every((p: { properties: { hours: Record<string, unknown[]> } }) => (p.properties.hours.Sunday ?? []).length > 0)).toBe(true);
    expect(places[0].query.explainability["signal.interests.entities"][0].entity_id).toMatch(/^4D4F434B-/);
    expect(res.body.query.explainability["signal.interests.entities"]).toHaveLength(4);
    expect(places[0].properties.description).toContain("OpenStreetMap");
  });

  it("recommends artists like the inputs, never the inputs, explained by the inputs", async () => {
    const ids = await idsFor(SOUL);
    const res = await call("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": ids, "signal.location": wktPolygon(CBD), "feature.explainability": "true", take: "10" });
    const artists = res.body.results.entities;
    expect(artists).toHaveLength(10);
    expect(artists.some((a: { entity_id: string }) => ids.includes(a.entity_id))).toBe(false);
    for (const artist of artists) {
      const why = artist.query.explainability["signal.interests.entities"] as { entity_id: string; score: number }[];
      expect(why.length).toBeGreaterThan(0);
      expect(why.every((w) => ids.includes(w.entity_id) && w.score >= 0.1 && w.score <= 1)).toBe(true);
    }
    const genres = artists.flatMap((a: { tags: { id: string }[] }) => a.tags.map((t) => t.id));
    expect(genres.filter((g: string) => /soul|funk|jazz/.test(g)).length).toBeGreaterThan(genres.length / 2);
  });

  it("scores a shortlist for the crowd at a point (filter.results.entities)", async () => {
    const ids = await idsFor(SOUL);
    const at = (lon: number, lat: number) => call("/v2/insights", { "filter.type": "urn:entity:artist", "filter.results.entities": ids, "signal.location": `POINT(${lon} ${lat})`, "signal.location.radius": "400" });
    const bennetts = (await at(144.9706, -37.8104)).body.results.entities;
    const docklands = (await at(144.94, -37.816)).body.results.entities;
    expect(bennetts).toHaveLength(4);
    const score = (rows: { entity_id: string; query: { affinity: number } }[]) => rows.reduce((s, r) => s + r.query.affinity, 0);
    expect(score(bennetts)).toBeGreaterThan(score(docklands));
  });
});

describe("qloo mock: demographics, tags, trending, compare", () => {
  it("returns a demographics row per signal", async () => {
    const ids = await idsFor(["Taylor Swift", "Gillian Welch"]);
    const res = await call("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": ids, "signal.interests.tags": "urn:tag:genre:music:jazz" });
    const rows = res.body.results.demographics;
    expect(rows).toHaveLength(3);
    const swift = rows.find((r: { entity_id: string }) => r.entity_id === ids.split(",")[0]);
    expect(swift.query.age["24_and_younger"]).toBeGreaterThan(swift.query.age["55_and_older"]);
    expect((await call("/v2/insights", { "filter.type": "urn:demographics" })).status).toBe(400);
  });

  it("returns genre tags for taste analysis, and none for other tag types", async () => {
    const ids = await idsFor(FOLK);
    const res = await call("/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": ids, "filter.tag.types": "urn:tag:genre:music", take: "3" });
    expect(res.body.results.tags[0]).toMatchObject({ subtype: "urn:tag:genre:music", tag_id: expect.stringContaining("folk") });
    expect((await call("/v2/insights", { "filter.type": "urn:tag", "filter.tag.types": "urn:tag:keyword:media" })).body.results.tags).toEqual([]);
    expect((await call("/v2/insights", { "filter.type": "urn:tag", "filter.parents.types": "urn:entity:movie" })).body.results.tags).toEqual([]);
    expect((await call("/v2/insights", { "filter.type": "urn:tag" })).body.results.tags[0].query).toEqual({});
  });

  it("returns weekly trending rows, newest first, that differ by artist", async () => {
    const [a, b] = CATALOG;
    const series = async (id: string) =>
      (await call("/v2/trending", { "signal.interests.entities": id, "filter.type": "urn:entity:artist", "filter.start_date": "2026-08-01", "filter.end_date": "2026-10-14" })).body.results.trending;
    const rowsA = await series(a.id);
    expect(rowsA[0].date).toBe("2026-10-14");
    expect(rowsA.every((r: { date: string }, i: number) => i === 0 || r.date < rowsA[i - 1].date)).toBe(true);
    expect(Object.keys(rowsA[0]).sort()).toEqual(["date", "population_percent_delta", "population_percentile", "population_rank", "population_rank_velocity", "velocity_fold_change"]);
    expect(rowsA).not.toEqual(await series(b.id));
    expect((await call("/v2/trending", { "signal.interests.entities": a.id, "filter.type": "urn:entity:artist" })).status).toBe(400);
    expect((await call("/v2/trending", { "filter.start_date": "2026-08-01", "filter.end_date": "2026-10-14" })).status).toBe(400);
    expect((await call("/v2/trending", { "filter.type": "urn:entity:artist", "filter.start_date": "2026-08-01", "filter.end_date": "2026-10-14" })).body.results.trending).toEqual([]);
  });

  it("compares two groups by genre", async () => {
    const res = await call("/v2/analysis/compare", { "a.signal.interests.entities": await idsFor(FOLK), "b.signal.interests.entities": await idsFor(SOUL), "filter.subtype": "urn:tag:genre" });
    const folk = res.body.results.find((r: { tag_id: string }) => r.tag_id === "urn:tag:genre:music:folk");
    expect(folk.query.a.affinity).toBeGreaterThan(folk.query.b.affinity);
    expect((await call("/v2/analysis/compare", { "a.signal.interests.entities": CATALOG[0].id })).status).toBe(400);
  });

  it("searches genre tags", async () => {
    expect((await call("/v2/tags", { "filter.query": "soul" })).body.results.tags.map((t: { id: string }) => t.id)).toEqual(["urn:tag:genre:music:soul", "urn:tag:genre:music:neo_soul"]);
  });
});
