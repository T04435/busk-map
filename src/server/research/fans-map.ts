import "server-only";
import { fansMapCity, fansMapSummary } from "@/lib/fans-map";
import type { FansMapOutput } from "@/lib/repertoire-research";
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import type { HeatCell } from "@/server/adapters/qloo/schema";
import { knownPlaces, nearestName } from "@/server/agent/where";
import { CITIES, type CityId } from "@/server/cities";

/** The heat cells the snapshot keeps (the strongest), so the saved research stays small. */
export const FANS_MAP_MAX_CELLS = 200;
/** A cell is named after a known place (hotspot, public spot) within this distance. */
export const FANS_MAP_NAME_RADIUS_M = 400;
/** How many of the strongest cells are looked at to find three distinct area names. */
const NAMING_POOL = 24;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

export class FansMapQlooDown extends Error {}

/**
 * The act's heat over a city: ONE urn:heatmap call (the busk planner's qloo.tasteMap, the same client function and call style:
 * signal = the act's own Qloo entity first, then its sound-alikes; area = the city's planning bbox), cached per signal and area by the
 * Qloo client's remote lookup cache, so each city costs one call cold and none warm. Areas are named the way the planner names a
 * cell (nearestName over the known places). Throws FansMapQlooDown when Qloo didn't answer.
 */
export async function fansMapFor(args: { cityId: CityId; own: { id: string; name: string }; alikes: { qlooId: string; name: string }[]; adapters: AdapterContext }): Promise<FansMapOutput> {
  const { cityId, own, alikes, adapters } = args;
  const city = CITIES[cityId];
  const signal = [own.id, ...alikes.map((a) => a.qlooId).filter((id) => id !== own.id)];
  const res = await qloo.tasteMap(signal, city.bbox, adapters);
  if (res.mode === "fallback") throw new FansMapQlooDown("Qloo didn't answer for where your fans are.");
  return fansMapOutput(cityId, res.data, [own.name, ...alikes.map((a) => a.name)]);
}

/** Pure: heat cells to the saved output (affinity relative to the best cell, strongest first, three named areas). */
export function fansMapOutput(cityId: CityId, heat: HeatCell[], signalledBy: string[]): FansMapOutput {
  const city = fansMapCity(cityId);
  const max = Math.max(0, ...heat.map((c) => c.affinity));
  const sorted = [...heat].sort((a, b) => b.affinity - a.affinity);
  const known = knownPlaces([], []);
  const areas: string[] = [];
  for (const c of sorted.slice(0, NAMING_POOL)) {
    const name = nearestName(c, known, FANS_MAP_NAME_RADIUS_M);
    if (name && !areas.includes(name)) areas.push(name);
    if (areas.length === 3) break;
  }
  const cells = max > 0 ? sorted.slice(0, FANS_MAP_MAX_CELLS).map((c) => ({ lat: r5(c.lat), lng: r5(c.lon), affinity: r2(c.affinity / max) })) : [];
  return { summary: fansMapSummary(areas, city.name), city, cells, areas, signalledBy };
}
