import { boxAround } from "@/lib/city";
import { distanceM, type BBox, type LatLon } from "@/lib/geo";
import { nameKey } from "@/lib/text";
import { DISTRICT_HALF_KM, DISTRICT_MIN_SEPARATION_KM, MAX_DISTRICTS, type District } from "./districts";
import type { HeatCellInput } from "./types";

/**
 * Named areas: the suburbs, towns and neighbourhoods around a metro (lib/city.ts isMetro), e.g. Miami Beach, Coral Gables and
 * Wynwood around Miami. Found once per plan (adapters/areas: OpenStreetMap place nodes, else the geocoder), each is given a
 * taste score from the one coarse heatmap the plan reads over the whole area (no extra Qloo call), and the best of them, spread
 * apart, become the districts the plan zooms into (scoring/districts.ts). Pure functions, no I/O.
 */

/** What a named area is, from OpenStreetMap's `place` tag or the geocoder's feature code. "city": the planned city itself. */
export type AreaKind = "city" | "town" | "city_district" | "suburb" | "quarter" | "village" | "neighbourhood";

export type NamedArea = LatLon & { name: string; kind: AreaKind; population: number | null };

/** Most named areas a plan keeps (the city itself included). */
export const MAX_AREAS = 10;
/** Two named areas are at least this far apart (km): the nearer of two close ones is the same part of the city. */
export const AREA_MIN_SEPARATION_KM = 1.5;
/** An area's taste and activity are read from the coarse heatmap cells within this distance of its centre (km). */
export const AREA_SAMPLE_KM = 1.5;

/** Bigger places first: a town or suburb says more about where people go than one neighbourhood does. */
const KIND_RANK: Record<AreaKind, number> = { city: -1, town: 0, city_district: 0, suburb: 0, quarter: 1, village: 1, neighbourhood: 2 };

/**
 * The areas a plan compares: the city itself first, then the found places inside `bbox` (towns and suburbs before
 * neighbourhoods, larger populations first, then nearer the centre), dropping any within AREA_MIN_SEPARATION_KM of one already
 * kept or sharing its name, at most `max` in all.
 */
export function pickAreas(found: readonly NamedArea[], city: { name: string; center: LatLon; bbox: BBox }, { max = MAX_AREAS, minSeparationKm = AREA_MIN_SEPARATION_KM } = {}): NamedArea[] {
  const inside = (p: LatLon) => p.lat >= city.bbox.south && p.lat <= city.bbox.north && p.lon >= city.bbox.west && p.lon <= city.bbox.east;
  const kept: NamedArea[] = [{ name: city.name, kind: "city", population: null, lat: city.center.lat, lon: city.center.lon }];
  const order = found
    .filter((a) => a.name.trim() && inside(a))
    .map((a) => ({ a, d: distanceM(a, city.center) }))
    .sort((x, y) => KIND_RANK[x.a.kind] - KIND_RANK[y.a.kind] || (y.a.population ?? -1) - (x.a.population ?? -1) || x.d - y.d || x.a.name.localeCompare(y.a.name));
  for (const { a } of order) {
    if (kept.length >= max) break;
    const key = nameKey(a.name);
    if (kept.some((k) => nameKey(k.name) === key || distanceM(k, a) < minSeparationKm * 1000)) continue;
    kept.push(a);
  }
  return kept;
}

export type RankedArea = NamedArea & {
  /** 1 for the best. */
  rank: number;
  /** The strongest coarse cell's affinity near the area (the whole-area read's own scale), 0 with none. */
  taste: number;
  /** `taste` against the best area's, 0 to 1. */
  share: number;
  /** The strongest coarse cell's Qloo popularity near the area (0 to 1), null with none. */
  activity: number | null;
  /** Coarse cells near the area. */
  cells: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Each area scored from the coarse whole-area heatmap (cells within AREA_SAMPLE_KM), best first: taste, then activity, then size. */
export function rankAreas(areas: readonly NamedArea[], cells: readonly HeatCellInput[], sampleKm = AREA_SAMPLE_KM): RankedArea[] {
  const scored = areas.map((area) => {
    const near = cells.filter((c) => distanceM(c, area) <= sampleKm * 1000);
    const taste = Math.max(0, ...near.map((c) => c.affinity));
    const pops = near.map((c) => c.popularity).filter((p): p is number => typeof p === "number");
    return { ...area, taste, activity: pops.length ? r2(Math.max(...pops)) : null, cells: near.length };
  });
  const top = Math.max(0, ...scored.map((a) => a.taste));
  return scored
    .sort((a, b) => b.taste - a.taste || (b.activity ?? -1) - (a.activity ?? -1) || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.name.localeCompare(b.name))
    .map((a, i) => ({ ...a, rank: i + 1, share: top > 0 ? r2(a.taste / top) : 0 }));
}

function clip(box: BBox, area: BBox): BBox {
  return { south: Math.max(box.south, area.south), west: Math.max(box.west, area.west), north: Math.min(box.north, area.north), east: Math.min(box.east, area.east) };
}

/**
 * The districts a metro zooms into, seeded by its ranked named areas: down the ranking, an area with any taste becomes a
 * district unless it is within `minSeparationKm` of one already chosen, until `max`. Each keeps its area's name, its box is
 * DISTRICT_HALF_KM around the area's centre (clipped to the planning area) and its strength is the area's taste. Empty when no
 * area has taste (the caller then falls back to the heatmap's peaks, findDistricts).
 */
export function districtsFromAreas(
  ranked: readonly RankedArea[],
  area: BBox,
  { max = MAX_DISTRICTS, minSeparationKm = DISTRICT_MIN_SEPARATION_KM, halfKm = DISTRICT_HALF_KM } = {},
): District[] {
  const picked: RankedArea[] = [];
  for (const a of ranked) {
    if (picked.length >= max) break;
    if (a.taste <= 0) continue;
    if (picked.every((p) => distanceM(p, a) >= minSeparationKm * 1000)) picked.push(a);
  }
  return picked.map((a, i) => {
    const center = { lat: r4(a.lat), lon: r4(a.lon) };
    return { id: `d${i + 1}`, name: a.name, center, bbox: clip(boxAround(center, halfKm, halfKm), area), affinity: a.taste, area: true };
  });
}
