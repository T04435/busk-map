import { cacheLife, cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { boxAround, cityFromPlace } from "@/lib/city";
import type { CallRecord } from "@/lib/call-record";
import { recordCalls } from "@/server/adapters/call-log";
import { areaFromElement, areasCacheKey, areasFromGeocode, buildAreasQuery, findNamedAreas, parseAreas, populationOf } from "@/server/adapters/areas";
import { syntheticAreas } from "@/server/adapters/areas/fixtures/synthetic";
import { OSM_CACHE_LIFE, OVERPASS_ENDPOINTS } from "@/server/adapters/osm/client";
import { TOKYO } from "@/server/offline-city";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

/** Named areas around a metro: OpenStreetMap place nodes, else the geocoder. All responses here are invented. */
const MIAMI = cityFromPlace("miami-florida-us", { name: "Miami", country: "United States", countryCode: "US", lat: 25.7743, lon: -80.1937, timeZone: "America/New_York", radiusKm: 15 });
const at = (dLat: number, dLon: number) => ({ lat: MIAMI.center.lat + dLat, lon: MIAMI.center.lon + dLon });
const node = (id: number, p: { lat: number; lon: number }, tags?: Record<string, string>) => ({ type: "node", id, lat: p.lat, lon: p.lon, tags });
const isOverpass = (u: URL) => (OVERPASS_ENDPOINTS as readonly string[]).includes(u.href);
const isGeocoder = (u: URL) => u.host === "geocoding-api.open-meteo.com";

describe("named areas query", () => {
  it("asks for named place nodes (suburbs, towns, neighbourhoods…) in the rounded bbox, one light query", () => {
    const q = buildAreasQuery({ south: 25.63911, west: -80.34312, north: 25.90944, east: -80.04411 });
    expect(q).toMatch(/^\[out:json\]\[timeout:5\]\[bbox:25\.639,-80\.343,25\.909,-80\.044\];/);
    expect(q).toContain('node["place"~"^(town|city_district|suburb|quarter|village|neighbourhood)$"]["name"];');
    expect(q).toMatch(/out body \d+;$/);
    expect(areasCacheKey({ south: 25.63911, west: -80.34312, north: 25.90944, east: -80.04411 })).toBe(areasCacheKey({ south: 25.6389, west: -80.3429, north: 25.9092, east: -80.0438 }));
    expect(areasCacheKey(MIAMI.bbox)).toMatch(/^osm-areas:/);
  });

  it("reads names (English first), kinds and populations, dropping rows that aren't named place nodes in the box", () => {
    expect(areaFromElement(node(1, at(0, 0.1), { place: "town", name: "Miami Beach", population: "82,890" }))).toEqual({ name: "Miami Beach", kind: "town", population: 82_890, ...at(0, 0.1) });
    expect(areaFromElement(node(2, at(0, 0), { place: "suburb", name: "渋谷", "name:en": "Shibuya" }))).toMatchObject({ name: "Shibuya", kind: "suburb", population: null });
    expect(areaFromElement(node(3, at(0, 0), { place: "suburb" }))).toBeNull();
    expect(areaFromElement(node(4, at(0, 0), { place: "square", name: "Plaza" }))).toBeNull();
    expect(areaFromElement({ type: "node", id: 5, tags: { place: "town", name: "Nowhere" } })).toBeNull();
    expect(areaFromElement("junk")).toBeNull();
    expect(populationOf("12 345")).toBe(12_345);
    expect(populationOf("about 5000")).toBeNull();
    const parsed = parseAreas([node(1, at(0, 0.1), { place: "town", name: "In" }), node(2, at(1, 0), { place: "town", name: "Out" })], MIAMI.bbox);
    expect(parsed.map((a) => a.name)).toEqual(["In"]);
  });

  it("reads the geocoder's populated places in the box as towns (a city section as a neighbourhood)", () => {
    const row = (id: number, name: string, p: { lat: number; lon: number }, feature_code: string, population?: number) => ({ id, name, latitude: p.lat, longitude: p.lon, feature_code, population });
    const areas = areasFromGeocode(
      [row(1, "Miami Beach", at(0.02, 0.06), "PPL", 82_000), row(2, "Wynwood", at(0.03, 0), "PPLX"), row(3, "Miami River", at(0, 0), "STM"), row(4, "Miami, Oklahoma", { lat: 36.87, lon: -94.88 }, "PPL"), row(5, "Old Miami", at(0.01, 0.01), "PPLH")],
      MIAMI.bbox,
    );
    expect(areas).toEqual([
      { name: "Miami Beach", kind: "town", population: 82_000, ...at(0.02, 0.06) },
      { name: "Wynwood", kind: "neighbourhood", population: null, ...at(0.03, 0) },
    ]);
  });
});

describe("findNamedAreas", () => {
  it("one Overpass query, cached 30 days, gives the city and its areas, deduped and capped", async () => {
    const nodes = [
      node(1, at(0.02, 0.06), { place: "town", name: "Miami Beach", population: "82890" }),
      node(2, at(-0.07, -0.08), { place: "town", name: "Coral Gables", population: "49000" }),
      node(3, at(0.03, 0), { place: "neighbourhood", name: "Wynwood" }),
      node(4, at(0.033, 0.002), { place: "neighbourhood", name: "Wynwood Arts" }),
    ];
    const { calls } = mockFetch([route(isOverpass, () => json({ elements: nodes }))]);
    const records: CallRecord[] = [];
    const { areas, source } = await recordCalls(records, () => findNamedAreas(MIAMI, LIVE));
    expect(source).toBe("osm");
    expect(areas.map((a) => a.name)).toEqual(["Miami", "Miami Beach", "Coral Gables", "Wynwood"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe("POST");
    expect(decodeURIComponent(String(calls[0].init?.body))).toContain('node["place"~');
    expect(vi.mocked(cacheLife)).toHaveBeenCalledWith(OSM_CACHE_LIFE);
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("osm");
    expect(records.filter((r) => r.provider === "osm")).toHaveLength(1);
  });

  it("falls back to the geocoder when Overpass fails, and to the city alone when both fail", async () => {
    const geocode = json({ results: [{ id: 1, name: "Miami Beach", latitude: at(0.02, 0.06).lat, longitude: at(0.02, 0.06).lon, feature_code: "PPL", population: 82_000 }] });
    mockFetch([route(isOverpass, () => json({ error: "busy" }, 502)), route(isGeocoder, () => geocode.clone())]);
    expect(await findNamedAreas(MIAMI, LIVE)).toEqual({ areas: [expect.objectContaining({ name: "Miami", kind: "city" }), expect.objectContaining({ name: "Miami Beach", kind: "town" })], source: "geocode" });
    mockFetch([route(isOverpass, () => json({ error: "busy" }, 502)), route(isGeocoder, () => json({ error: "down" }, 500))]);
    expect(await findNamedAreas({ ...MIAMI, bbox: boxAround(MIAMI.center, 14, 14) }, LIVE)).toEqual({ areas: [expect.objectContaining({ name: "Miami" })], source: "none" });
  });

  it("offline: the synthetic metro's named areas, the neighbourhood next to a hub dropped", async () => {
    const metro = cityFromPlace("tokyo-jp", { name: "Tokyo", country: "Japan", countryCode: "JP", lat: TOKYO.center.lat, lon: TOKYO.center.lon, timeZone: "Asia/Tokyo", radiusKm: 15 });
    const { areas, source } = await findNamedAreas(metro, OFFLINE);
    expect(source).toBe("osm");
    expect(areas.map((a) => a.name)).toEqual(["Tokyo", "Synthetic Nakano", "Synthetic Shibuya", "Synthetic Asakusa", "Synthetic Ueno"]);
    expect(syntheticAreas({ center: { lat: -37.8, lon: 144.9 } }).elements).toEqual([]);
    // Overpass down offline: the geocoder fixture knows no place around Tokyo but Tokyo itself.
    expect(await findNamedAreas(metro, { offline: true, faults: ["osm"] })).toEqual({ areas: [expect.objectContaining({ name: "Tokyo" })], source: "none" });
  });
});
