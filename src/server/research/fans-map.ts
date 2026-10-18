import "server-only";
import { fansMapSummary, WORLD_BBOX } from "@/lib/fans-map";
import { distanceM, inBBox } from "@/lib/geo";
import type { FansMapCity, FansMapOutput } from "@/lib/repertoire-research";
import { nearestWorldPlace, worldPlaceLabel } from "@/lib/world-places";
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import type { HeatCell } from "@/server/adapters/qloo/schema";
import { knownPlaces, nearestName } from "@/server/agent/where";
import { CITIES, CITY_IDS, type CityId } from "@/server/cities";

/** The heat cells the snapshot keeps (the strongest), so the saved research stays small. */
export const FANS_MAP_MAX_CELLS = 200;
/** Inside a Busk Map city, a cell is named after a known place (hotspot, public spot) within this distance. */
export const FANS_MAP_NAME_RADIUS_M = 400;
/** Elsewhere a cell is named after the nearest listed world city, if one lies within this distance. */
export const FANS_MAP_WORLD_RADIUS_KM = 200;
/** U40: a cell joins the city clusters when its affinity is at least this share of the strongest cell's. */
export const FANS_MAP_CITY_MIN_AFFINITY = 0.48;
/** Neighbouring cells join one cluster within this many times the median spacing between cells. */
export const FANS_MAP_CLUSTER_SPACINGS = 3;
/** Reach never exceeds this (m), so sparse or very coarse cells can't swallow neighbouring cities into one. */
export const FANS_MAP_MAX_REACH_M = 40_000;
/** The map labels at most this many cities. */
export const FANS_MAP_MAX_CITIES = 8;
/** The cells looked at to find the median spacing (the strongest), so the pairwise pass stays cheap. */
const SPACING_SAMPLE = 1500;

/**
 * U40: Qloo's `output.heatmap.boundary` ("city" | "neighborhood"; geohash squares by default). OFF until a live probe confirms the
 * response shape (cells with latitude/longitude) for a world-sized area; set to "city" to ask Qloo for city-level cells.
 */
export const FANS_MAP_BOUNDARY: qloo.HeatmapBoundary | undefined = undefined;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

export class FansMapQlooDown extends Error {}

/**
 * The act's heat across the world: ONE urn:heatmap call (the busk planner's qloo.tasteMap, the same client function and call style:
 * signal = the act's own Qloo entity first, then its sound-alikes; area = the whole world), cached per signal for 24 hours by the
 * Qloo client's remote lookup cache. Throws FansMapQlooDown when Qloo didn't answer.
 */
export async function fansMapFor(args: { own: { id: string; name: string }; alikes: { qlooId: string; name: string }[]; adapters: AdapterContext }): Promise<FansMapOutput> {
  const { own, alikes, adapters } = args;
  const signal = [own.id, ...alikes.map((a) => a.qlooId).filter((id) => id !== own.id)];
  const res = await qloo.tasteMap(signal, WORLD_BBOX, adapters, FANS_MAP_BOUNDARY);
  if (res.mode === "fallback") throw new FansMapQlooDown("Qloo didn't answer for where your fans are.");
  return fansMapOutput(res.data, [own.name, ...alikes.map((a) => a.name)]);
}

/** The Busk Map city whose planning area holds a point. */
export const buskMapCityAt = (point: { lat: number; lon: number }): CityId | null => CITY_IDS.find((id) => inBBox(point, CITIES[id].bbox)) ?? null;

type Named = { group: string; name: string; cityId: CityId | null };

/** The place a cell is named after (null when no listed world city lies near it): the planner's naming inside a Busk Map city, else the nearest world city. */
function nameCell(c: HeatCell, known: ReturnType<typeof knownPlaces>): Named | null {
  const { place, km } = nearestWorldPlace(c);
  if (km > FANS_MAP_WORLD_RADIUS_KM) return null;
  const cityId = buskMapCityAt(c);
  const name = cityId ? (nearestName(c, known, FANS_MAP_NAME_RADIUS_M) ?? CITIES[cityId].name) : worldPlaceLabel(place);
  return { group: `${place.name}|${place.country}`, name, cityId };
}

/**
 * Pure: the strongest cells grouped by place, three distinct names. A cell inside a Busk Map city is named the way the planner names
 * it (nearestName over that city's hotspots and spots, else the city's name); any other cell by the nearest entry of the world city
 * list. The first (strongest) cell of a place names it.
 */
export function topPlaces(sorted: HeatCell[]): { areas: string[]; planCity: string | null } {
  const known = knownPlaces([], []);
  const areas: string[] = [];
  const seen = new Set<string>();
  let planCity: string | null = null;
  for (const c of sorted) {
    const n = nameCell(c, known);
    if (!n || seen.has(n.group)) continue;
    seen.add(n.group);
    if (areas.length === 0) planCity = n.cityId;
    areas.push(n.name);
    if (areas.length === 3) break;
  }
  return { areas, planCity };
}

/** The median distance (m) from a cell to its nearest neighbour: the grid spacing of the heatmap, whatever resolution Qloo answered at. */
export function medianCellSpacingM(cells: readonly HeatCell[]): number {
  const sample = cells.slice(0, SPACING_SAMPLE);
  if (sample.length < 2) return 0;
  const nearest = sample.map((a, i) => {
    let best = Infinity;
    for (let j = 0; j < sample.length; j++) if (j !== i) best = Math.min(best, distanceM(a, sample[j]));
    return best;
  });
  nearest.sort((a, b) => a - b);
  return nearest[Math.floor(nearest.length / 2)];
}

/**
 * U40: the map's cities. Cells at or above 0.48 of the strongest are clustered (single linkage: neighbours within 3x the median cell
 * spacing share a cluster); each cluster is named by its strongest cell with the place naming above (a cluster no listed city lies near
 * is dropped, and a second cluster of an already named city is merged into the stronger one). A city's affinity is its cluster's best
 * cell over the global best. Strongest first, at most 8. `sorted` is strongest first; `all` sets the spacing (defaults to `sorted`).
 */
export function cityClusters(sorted: HeatCell[], all: readonly HeatCell[] = sorted): (FansMapCity & { cityId: CityId | null })[] {
  const max = sorted[0]?.affinity ?? 0;
  if (max <= 0) return [];
  const members = sorted.filter((c) => c.affinity / max >= FANS_MAP_CITY_MIN_AFFINITY);
  const reach = Math.min(FANS_MAP_MAX_REACH_M, FANS_MAP_CLUSTER_SPACINGS * medianCellSpacingM(all));
  const parent = members.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) if (distanceM(members[i], members[j]) <= reach) parent[find(j)] = find(i);
  }
  // `members` is strongest first, so the first member met of a cluster is its strongest cell.
  const firstOf = new Map<number, HeatCell>();
  for (let i = 0; i < members.length; i++) if (!firstOf.has(find(i))) firstOf.set(find(i), members[i]);
  const known = knownPlaces([], []);
  const seen = new Set<string>();
  const cities: (FansMapCity & { cityId: CityId | null })[] = [];
  for (const c of [...firstOf.values()].sort((a, b) => b.affinity - a.affinity)) {
    const n = nameCell(c, known);
    if (!n || seen.has(n.group)) continue;
    seen.add(n.group);
    cities.push({ name: n.name, lat: r5(c.lat), lng: r5(c.lon), affinity: r2(c.affinity / max), cityId: n.cityId });
    if (cities.length === FANS_MAP_MAX_CITIES) break;
  }
  return cities;
}

/** Pure: heat cells to the saved output (affinity relative to the best cell, strongest first, up to 8 named cities, the first three as the places). */
export function fansMapOutput(heat: HeatCell[], signalledBy: string[]): FansMapOutput {
  const max = Math.max(0, ...heat.map((c) => c.affinity));
  const sorted = [...heat].sort((a, b) => b.affinity - a.affinity);
  const found = cityClusters(sorted);
  const cities: FansMapCity[] = found.map(({ cityId: _cityId, ...city }) => city);
  const { areas, planCity } = found.length > 0 ? { areas: found.slice(0, 3).map((c) => c.name), planCity: found[0].cityId } : topPlaces(sorted);
  const cells = max > 0 ? sorted.slice(0, FANS_MAP_MAX_CELLS).map((c) => ({ lat: r5(c.lat), lng: r5(c.lon), affinity: r2(c.affinity / max) })) : [];
  return { summary: fansMapSummary(areas), cells, areas, planCity, cities, signalledBy };
}
