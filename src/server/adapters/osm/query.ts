/**
 * OpenStreetMap pitches for any city but Melbourne (V2 2.3): the Overpass query, and its answer turned into walkable public
 * spots. Pure functions, no I/O (client.ts sends the query, index.ts wraps it as an adapter).
 *
 * What a busker can stand at, in OSM tags:
 * - place=square: squares and plazas
 * - highway=pedestrian (ways and areas): pedestrian streets, malls, plazas mapped as areas
 * - amenity=marketplace: market squares
 * - highway=footway named …promenade / boardwalk / esplanade: waterfront walks
 * - railway=station (named): the station forecourt
 * - leisure=park (named): the park, at its centre
 * Private or no-access features, tunnels, indoor and underground ways are left out. Being on the list says nothing about
 * legality: a city with no council data gets the "rules not checked" line on every pitch (cities.ts rulesFor).
 */
import { distanceM, round, type BBox, type LatLon } from "@/lib/geo";
import { nameKey } from "@/lib/text";
import type { PublicSpot, SpotKind } from "@/server/data/spots";
import { CELL_PITCH_SPACING_M } from "@/server/scoring/candidates";
import { overpassElementSchema, type OverpassElement } from "./schema";

/** Most spots one city gets. */
export const OSM_SPOTS_MAX = 150;
/** Spots closer than this are one pitch: the engine's spacing for pitches with no curated spot (candidates.ts). */
export const OSM_SPOT_SPACING_M = CELL_PITCH_SPACING_M;
/** Two pieces of one named street or park (OSM splits long ways) closer than this are the same place. */
export const OSM_SAME_NAME_M = 600;
/** Overpass's own time limit for the query (seconds), under the client's timeout. */
export const OVERPASS_QUERY_TIMEOUT_S = 8;
/** Elements Overpass may return before we pick: generous, since unnamed ones are dropped first. */
export const OVERPASS_OUT_MAX = 600;

/** Leaves out what nobody may busk in: private, no access, tunnels, indoor and underground. */
const PUBLIC = `["access"!~"^(private|no)$"]["tunnel"!="yes"]["indoor"!="yes"]["level"!~"^-"]`;

/** The query's bounding box, rounded to about 100 m so nearby planning areas share one cached answer. */
export function overpassBBox(box: BBox): BBox {
  return { south: round(box.south, 3), west: round(box.west, 3), north: round(box.north, 3), east: round(box.east, 3) };
}

/** The cache key a city's spots are stored under: its rounded bounding box. */
export function osmCacheKey(box: BBox): string {
  const b = overpassBBox(box);
  return `osm-spots:${b.south},${b.west},${b.north},${b.east}`;
}

/** The Overpass QL for busking-suitable public spaces inside `box`. */
export function buildOverpassQuery(box: BBox): string {
  const b = overpassBBox(box);
  return [
    `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}][bbox:${b.south},${b.west},${b.north},${b.east}];`,
    "(",
    `  nwr["place"="square"]${PUBLIC};`,
    `  way["highway"="pedestrian"]${PUBLIC};`,
    `  relation["highway"="pedestrian"]${PUBLIC};`,
    `  nwr["amenity"="marketplace"]${PUBLIC};`,
    `  way["highway"="footway"]["name"~"promenade|boardwalk|esplanade",i]${PUBLIC};`,
    `  node["railway"="station"]["name"]${PUBLIC};`,
    `  nwr["leisure"="park"]["name"]${PUBLIC};`,
    ");",
    `out tags center ${OVERPASS_OUT_MAX};`,
  ].join("\n");
}

/** What a feature is, best pitch first. Null for a feature the query should not have returned. */
export function spotKindOf(tags: Record<string, string>): SpotKind | null {
  if (tags.place === "square") return "square";
  if (tags.amenity === "marketplace") return "square";
  if (tags.highway === "pedestrian") return "pedestrian-street";
  if (tags.highway === "footway") return "promenade";
  if (tags.railway === "station") return "forecourt";
  if (tags.leisure === "park") return "park-edge";
  return null;
}

const KIND_RANK: Record<SpotKind, number> = { square: 0, "pedestrian-street": 1, laneway: 1, promenade: 2, forecourt: 3, bridge: 4, "park-edge": 5 };

/** The name an unnamed feature shows. */
const UNNAMED: Record<SpotKind, string> = {
  square: "Public square",
  "pedestrian-street": "Pedestrian street",
  laneway: "Laneway",
  promenade: "Promenade",
  forecourt: "Station forecourt",
  bridge: "Footbridge",
  "park-edge": "Park",
};

const clean = (s: string | undefined) => s?.replace(/\s+/g, " ").trim().slice(0, 80) || null;

/** The name a feature shows: English where OSM has it, else the local name; a station's says it is one. */
export function spotName(tags: Record<string, string>, kind: SpotKind): string | null {
  const name = clean(tags["name:en"]) ?? clean(tags.name);
  if (!name) return null;
  if (kind === "forecourt" && !/station|駅/i.test(name)) return `${name} Station`;
  return name;
}

type Parsed = PublicSpot & { named: boolean; rank: number };

/** One element as a spot, or null (no point, no kind, a row that doesn't parse). */
export function elementToSpot(raw: unknown): Parsed | null {
  const parsed = overpassElementSchema.safeParse(raw);
  if (!parsed.success) return null;
  const el: OverpassElement = parsed.data;
  const tags = el.tags ?? {};
  const kind = spotKindOf(tags);
  const point: LatLon | null = el.lat !== undefined && el.lon !== undefined ? { lat: el.lat, lon: el.lon } : (el.center ?? null);
  if (!kind || !point) return null;
  const name = spotName(tags, kind);
  return { id: `osm:${el.type[0]}${el.id}`, name: name ?? UNNAMED[kind], kind, lat: round(point.lat, 6), lon: round(point.lon, 6), named: name !== null, rank: KIND_RANK[kind] };
}

/**
 * The spots from an Overpass answer: inside `box`, named features first (then squares before streets before parks), one per
 * place (the same name nearby, or anything closer than OSM_SPOT_SPACING_M to a spot already kept), at most `max`.
 */
export function osmSpots(elements: readonly unknown[], box: BBox, max = OSM_SPOTS_MAX): PublicSpot[] {
  const inside = (p: LatLon) => p.lat >= box.south && p.lat <= box.north && p.lon >= box.west && p.lon <= box.east;
  const all = elements
    .map(elementToSpot)
    .filter((s): s is Parsed => s !== null && inside(s))
    .sort((a, b) => Number(b.named) - Number(a.named) || a.rank - b.rank || a.id.localeCompare(b.id));
  const kept: Parsed[] = [];
  for (const spot of all) {
    if (kept.length >= max) break;
    const key = nameKey(spot.name);
    const dup = kept.some((k) => {
      const d = distanceM(k, spot);
      return d < OSM_SPOT_SPACING_M || (spot.named && k.named && nameKey(k.name) === key && d < OSM_SAME_NAME_M);
    });
    if (!dup) kept.push(spot);
  }
  return kept.map(({ id, name, kind, lat, lon }) => ({ id, name, kind, lat, lon }));
}

/** An Overpass `remark` that means the query failed part-way (its elements are then incomplete). */
export function overpassFailed(remark: string | undefined): boolean {
  return remark !== undefined && /runtime error|timed out|out of memory|error/i.test(remark);
}
