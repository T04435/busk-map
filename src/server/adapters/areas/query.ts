/**
 * Named areas around a metro (scoring/areas.ts): the Overpass query for OpenStreetMap's named `place` nodes (suburbs, towns,
 * neighbourhoods…) and its answer as areas, plus the geocoder's rows as areas when Overpass is down. Pure functions, no I/O
 * (client.ts sends the query, index.ts wraps it as an adapter).
 */
import type { BBox, LatLon } from "@/lib/geo";
import type { AreaKind, NamedArea } from "@/server/scoring/areas";
import type { GeocodeResult } from "../geocode/schema";
import { overpassBBox, OVERPASS_QUERY_TIMEOUT_S } from "../osm/query";
import { overpassElementSchema } from "../osm/schema";

/** The OpenStreetMap `place` values that name a part of a metro. */
export const AREA_PLACES = ["town", "city_district", "suburb", "quarter", "village", "neighbourhood"] as const satisfies readonly AreaKind[];
/** Place nodes Overpass may return before we pick (a big metro maps a few hundred). */
export const AREAS_OUT_MAX = 400;
/** Places the geocoder is asked for by the city's name when Overpass is down (Open-Meteo's most). */
export const GEOCODE_AREAS_ASK = 100;

/** The cache key a metro's named areas are stored under: its rounded bounding box. */
export function areasCacheKey(box: BBox): string {
  const b = overpassBBox(box);
  return `osm-areas:${b.south},${b.west},${b.north},${b.east}`;
}

/** The Overpass QL for named place nodes inside `box`: one light query (nodes only, tags and position). */
export function buildAreasQuery(box: BBox): string {
  const b = overpassBBox(box);
  return [
    `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}][bbox:${b.south},${b.west},${b.north},${b.east}];`,
    `node["place"~"^(${AREA_PLACES.join("|")})$"]["name"];`,
    `out body ${AREAS_OUT_MAX};`,
  ].join("\n");
}

/** A `population` tag as a number ("12,345", "12 345", "12345"), null when absent or unreadable. */
export function populationOf(tag: string | undefined): number | null {
  if (!tag) return null;
  const digits = tag.replace(/[\s,._]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

const clean = (s: string | undefined) => s?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
const isPlace = (value: string | undefined): value is (typeof AREA_PLACES)[number] => (AREA_PLACES as readonly string[]).includes(value ?? "");

/** One Overpass element as an area, or null (not a named place node with a position). English name where OSM has one. */
export function areaFromElement(raw: unknown): NamedArea | null {
  const parsed = overpassElementSchema.safeParse(raw);
  if (!parsed.success) return null;
  const el = parsed.data;
  const tags = el.tags ?? {};
  const name = clean(tags["name:en"]) ?? clean(tags.name);
  const point: LatLon | null = el.lat !== undefined && el.lon !== undefined ? { lat: el.lat, lon: el.lon } : (el.center ?? null);
  if (!name || !point || !isPlace(tags.place)) return null;
  return { name, kind: tags.place, population: populationOf(tags.population), lat: point.lat, lon: point.lon };
}

const inside = (box: BBox) => (p: LatLon) => p.lat >= box.south && p.lat <= box.north && p.lon >= box.west && p.lon <= box.east;

/** The named areas in an Overpass answer, inside `box` (unordered: scoring/areas.ts pickAreas orders, dedupes and caps). */
export function parseAreas(elements: readonly unknown[], box: BBox): NamedArea[] {
  return elements.map(areaFromElement).filter((a): a is NamedArea => a !== null && inside(box)(a));
}

/**
 * The geocoder's rows (a search by the city's name: "Miami" finds Miami Beach, North Miami, Miami Gardens…) as areas inside
 * `box`: populated places only, a section of a city (PPLX) as a neighbourhood, any other as a town.
 */
export function areasFromGeocode(rows: readonly GeocodeResult[], box: BBox): NamedArea[] {
  return rows
    .filter((r) => /^PPL(?!H|Q|W|CH)/.test(r.feature_code ?? "") && inside(box)({ lat: r.latitude, lon: r.longitude }))
    .map((r) => ({ name: r.name.slice(0, 80), kind: r.feature_code === "PPLX" ? "neighbourhood" : "town", population: r.population ?? null, lat: r.latitude, lon: r.longitude }));
}
