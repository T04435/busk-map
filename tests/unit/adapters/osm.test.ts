import { cacheLife, cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { MELBOURNE } from "@/lib/city";
import { distanceM, inBBox } from "@/lib/geo";
import { getOsmSpots } from "@/server/adapters/osm";
import { OSM_CACHE_LIFE, OVERPASS_TIMEOUT_MS, OVERPASS_URL, overpassUserAgent } from "@/server/adapters/osm/client";
import { syntheticOverpass } from "@/server/adapters/osm/fixtures/synthetic";
import { buildOverpassQuery, elementToSpot, osmCacheKey, osmSpots, OSM_SPOT_SPACING_M, OSM_SPOTS_MAX, overpassBBox, overpassFailed, spotName } from "@/server/adapters/osm/query";
import { TOKYO } from "@/server/offline-city";
import { json, LIVE, mockFetch, OFFLINE, route, timeoutError } from "../../helpers";

/** V2 2.3: OpenStreetMap pitches for any city but Melbourne, through Overpass. All responses here are invented. */
const BOX = TOKYO.bbox;
const at = (dLat: number, dLon: number) => ({ lat: TOKYO.center.lat + dLat, lon: TOKYO.center.lon + dLon });
const node = (id: number, p: { lat: number; lon: number }, tags?: Record<string, string>) => ({ type: "node", id, lat: p.lat, lon: p.lon, tags });
const way = (id: number, p: { lat: number; lon: number }, tags?: Record<string, string>) => ({ type: "way", id, center: p, tags });
const isOverpass = (u: URL) => u.href === OVERPASS_URL;

describe("Overpass query", () => {
  it("asks for squares, pedestrian streets and areas, markets, promenades, stations and parks in the rounded bbox", () => {
    const q = buildOverpassQuery({ south: 35.67511, west: 139.66841, north: 35.70389, east: 139.71499 });
    expect(q).toMatch(/^\[out:json\]\[timeout:8\]\[bbox:35\.675,139\.668,35\.704,139\.715\];/);
    expect(q).toContain('nwr["place"="square"]');
    expect(q).toContain('way["highway"="pedestrian"]');
    expect(q).toContain('relation["highway"="pedestrian"]');
    expect(q).toContain('nwr["amenity"="marketplace"]');
    expect(q).toContain('way["highway"="footway"]["name"~"promenade|boardwalk|esplanade",i]');
    expect(q).toContain('node["railway"="station"]["name"]');
    expect(q).toContain('nwr["leisure"="park"]["name"]');
    // Private, tunnels, indoor and underground are filtered in every clause.
    expect(q.match(/\["access"!~"\^\(private\|no\)\$"\]\["tunnel"!="yes"\]\["indoor"!="yes"\]/g)).toHaveLength(7);
    expect(q).toMatch(/out tags center \d+;$/);
  });

  it("keys the cache by the bbox rounded to about 100 m", () => {
    expect(overpassBBox({ south: 35.67511, west: 139.66841, north: 35.70389, east: 139.71499 })).toEqual({ south: 35.675, west: 139.668, north: 35.704, east: 139.715 });
    expect(osmCacheKey({ south: 35.67511, west: 139.66841, north: 35.70389, east: 139.71499 })).toBe(osmCacheKey({ south: 35.6749, west: 139.6682, north: 35.7041, east: 139.7148 }));
    expect(osmCacheKey(BOX)).not.toBe(osmCacheKey(MELBOURNE.bbox));
    expect(osmCacheKey(BOX)).toMatch(/^osm-spots:-?\d/);
  });

  it("treats a remark about a runtime error as a failed query", () => {
    expect(overpassFailed(undefined)).toBe(false);
    expect(overpassFailed("runtime error: Query timed out in \"query\" at line 3 after 9 seconds.")).toBe(true);
    expect(overpassFailed("runtime error: Query run out of memory using about 2048 MB of RAM.")).toBe(true);
  });
});

describe("Overpass answer to spots", () => {
  it("reads nodes and way centres, kinds and names (English first, stations named as such)", () => {
    expect(elementToSpot(node(1, at(0, 0), { place: "square", name: "広場", "name:en": "Plaza One" }))).toMatchObject({ id: "osm:n1", name: "Plaza One", kind: "square", named: true });
    expect(elementToSpot(way(2, at(0, 0), { highway: "pedestrian", area: "yes" }))).toMatchObject({ id: "osm:w2", name: "Pedestrian street", kind: "pedestrian-street", named: false });
    expect(elementToSpot(node(3, at(0, 0), { amenity: "marketplace", name: "Market" }))).toMatchObject({ kind: "square" });
    expect(elementToSpot(node(4, at(0, 0), { railway: "station", name: "Shinjuku" }))).toMatchObject({ kind: "forecourt", name: "Shinjuku Station" });
    expect(spotName({ railway: "station", name: "新宿駅" }, "forecourt")).toBe("新宿駅");
    expect(elementToSpot({ type: "relation", id: 5, center: at(0, 0), tags: { leisure: "park", name: "Park" } })).toMatchObject({ id: "osm:r5", kind: "park-edge" });
    // No position, no kind, or not an element: dropped.
    expect(elementToSpot({ type: "way", id: 6, tags: { place: "square", name: "x" } })).toBeNull();
    expect(elementToSpot(node(7, at(0, 0), { shop: "bakery", name: "x" }))).toBeNull();
    expect(elementToSpot({ nope: true })).toBeNull();
  });

  it("puts named features first, drops near duplicates and pieces of one named street, and keeps inside the bbox", () => {
    const spots = osmSpots(
      [
        way(10, at(0.0001, 0.0001), { highway: "pedestrian" }), // unnamed, next to the square: dropped
        node(11, at(0, 0), { place: "square", name: "Alpha Square" }),
        way(12, at(0.005, 0), { highway: "pedestrian", name: "Beta Street" }),
        way(13, at(0.0085, 0), { highway: "pedestrian", name: "Beta Street" }), // same street 390 m on: one place
        way(14, at(-0.005, 0.005), { highway: "pedestrian", area: "yes" }), // unnamed, alone: kept, last
        node(15, at(0.5, 0.5), { place: "square", name: "Far Square" }), // outside the bbox
        node(16, at(0.001, 0), { leisure: "park", name: "Gamma Park" }), // 111 m from Alpha: dropped
      ],
      BOX,
    );
    expect(spots.map((s) => s.name)).toEqual(["Alpha Square", "Beta Street", "Pedestrian street"]);
    expect(spots.map((s) => s.id)).toEqual(["osm:n11", "osm:w12", "osm:w14"]);
    for (const [i, a] of spots.entries()) for (const b of spots.slice(i + 1)) expect(distanceM(a, b)).toBeGreaterThanOrEqual(OSM_SPOT_SPACING_M);
  });

  it("caps the list", () => {
    const grid = Array.from({ length: 400 }, (_, i) => node(100 + i, at(-0.014 + Math.floor(i / 20) * 0.0014, -0.019 + (i % 20) * 0.0019), { place: "square", name: `S${i}` }));
    expect(osmSpots(grid, BOX, 5)).toHaveLength(5);
    expect(osmSpots(grid, BOX).length).toBeLessThanOrEqual(OSM_SPOTS_MAX);
  });
});

describe("getOsmSpots", () => {
  it("POSTs the query to Overpass with a User-Agent and a timeout, cached 30 days", async () => {
    const { calls } = mockFetch([route(isOverpass, () => json({ elements: [node(1, at(0, 0), { place: "square", name: "Alpha Square" })] }))]);
    const result = await getOsmSpots(TOKYO, LIVE);
    expect(result).toMatchObject({ adapter: "osm", source: "osm", mode: "live" });
    expect(result.data).toEqual([{ id: "osm:n1", name: "Alpha Square", kind: "square", lat: at(0, 0).lat, lon: at(0, 0).lon }]);
    expect(calls).toHaveLength(1);
    const init = calls[0].init!;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(overpassUserAgent());
    expect(overpassUserAgent()).toMatch(/^BuskMap\/\S+ \(busking planner/);
    expect(new URLSearchParams(String(init.body)).get("data")).toBe(buildOverpassQuery(TOKYO.bbox));
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(OVERPASS_TIMEOUT_MS).toBe(10_000);
    expect(vi.mocked(cacheLife)).toHaveBeenCalledWith(OSM_CACHE_LIFE);
    expect(OSM_CACHE_LIFE.revalidate).toBe(30 * 86_400);
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("osm");
  });

  it("falls back to no spots on an HTTP error, a timeout, a bad answer or a stopped query", async () => {
    mockFetch([route(isOverpass, () => json({ error: "busy" }, 429))]);
    expect(await getOsmSpots(TOKYO, LIVE)).toMatchObject({ mode: "fallback", reason: "rate_limited", data: [] });
    mockFetch([route(isOverpass, () => Promise.reject(timeoutError()))]);
    expect(await getOsmSpots(TOKYO, LIVE)).toMatchObject({ mode: "fallback", reason: "timeout", data: [] });
    mockFetch([route(isOverpass, () => json({ nope: 1 }))]);
    expect(await getOsmSpots(TOKYO, LIVE)).toMatchObject({ mode: "fallback", reason: "invalid_response", data: [] });
    mockFetch([route(isOverpass, () => json({ elements: [node(1, at(0, 0), { place: "square", name: "A" })], remark: "runtime error: Query timed out" }))]);
    expect(await getOsmSpots(TOKYO, LIVE)).toMatchObject({ mode: "fallback", reason: "timeout", data: [] });
  });

  it("an empty answer is no spots (live)", async () => {
    mockFetch([route(isOverpass, () => json({ elements: [] }))]);
    expect(await getOsmSpots(TOKYO, LIVE)).toMatchObject({ mode: "live", data: [] });
  });

  it("a simulated outage never calls Overpass", async () => {
    const { calls } = mockFetch([]);
    expect(await getOsmSpots(TOKYO, { offline: false, faults: ["osm"] })).toMatchObject({ mode: "fallback", reason: "fault_injected", data: [] });
    expect(calls).toHaveLength(0);
  });

  it("offline: the synthetic answer for Tokyo, none elsewhere, and no request", async () => {
    const { calls } = mockFetch([]);
    const tokyo = await getOsmSpots(TOKYO, OFFLINE);
    expect(tokyo.mode).toBe("synthetic");
    expect(tokyo.data.length).toBeGreaterThan(10);
    expect(tokyo.data.every((s) => inBBox(s, TOKYO.bbox))).toBe(true);
    expect(tokyo.data.filter((s) => s.name.startsWith("Synthetic OSM ")).length).toBe(tokyo.data.length - 1);
    expect(tokyo.data.map((s) => s.name)).toContain("Pedestrian street");
    expect(new Set(tokyo.data.map((s) => s.id)).size).toBe(tokyo.data.length);
    const elsewhere = { bbox: { south: 48.84, west: 2.33, north: 48.87, east: 2.37 }, center: { lat: 48.8566, lon: 2.3522 } };
    expect((await getOsmSpots(elsewhere, OFFLINE)).data).toEqual([]);
    expect(syntheticOverpass(MELBOURNE).elements).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
