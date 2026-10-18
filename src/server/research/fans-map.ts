import "server-only";
import { fansMapSummary, WORLD_BBOX } from "@/lib/fans-map";
import { inBBox } from "@/lib/geo";
import type { FansMapOutput } from "@/lib/repertoire-research";
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
  const res = await qloo.tasteMap(signal, WORLD_BBOX, adapters);
  if (res.mode === "fallback") throw new FansMapQlooDown("Qloo didn't answer for where your fans are.");
  return fansMapOutput(res.data, [own.name, ...alikes.map((a) => a.name)]);
}

/** The Busk Map city whose planning area holds a point. */
export const buskMapCityAt = (point: { lat: number; lon: number }): CityId | null => CITY_IDS.find((id) => inBBox(point, CITIES[id].bbox)) ?? null;

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
    const { place, km } = nearestWorldPlace(c);
    if (km > FANS_MAP_WORLD_RADIUS_KM) continue;
    const group = `${place.name}|${place.country}`;
    if (seen.has(group)) continue;
    const cityId = buskMapCityAt(c);
    const name = cityId ? (nearestName(c, known, FANS_MAP_NAME_RADIUS_M) ?? CITIES[cityId].name) : worldPlaceLabel(place);
    seen.add(group);
    if (areas.length === 0) planCity = cityId;
    areas.push(name);
    if (areas.length === 3) break;
  }
  return { areas, planCity };
}

/** Pure: heat cells to the saved output (affinity relative to the best cell, strongest first, three named places). */
export function fansMapOutput(heat: HeatCell[], signalledBy: string[]): FansMapOutput {
  const max = Math.max(0, ...heat.map((c) => c.affinity));
  const sorted = [...heat].sort((a, b) => b.affinity - a.affinity);
  const { areas, planCity } = topPlaces(sorted);
  const cells = max > 0 ? sorted.slice(0, FANS_MAP_MAX_CELLS).map((c) => ({ lat: r5(c.lat), lng: r5(c.lon), affinity: r2(c.affinity / max) })) : [];
  return { summary: fansMapSummary(areas), cells, areas, planCity, signalledBy };
}
