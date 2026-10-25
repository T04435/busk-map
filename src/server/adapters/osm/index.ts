import "server-only";
import type { City } from "@/lib/city";
import type { PublicSpot } from "@/server/data/spots";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchOsmSpotsRecorded } from "./client";
import { syntheticOverpass } from "./fixtures/synthetic";
import { osmCacheKey, osmSpots } from "./query";

export { buildOverpassQuery, osmCacheKey, osmSpots, OSM_SPOTS_MAX } from "./query";

/**
 * Walkable public spots from OpenStreetMap for a city with no curated list (every city but Melbourne, V2 2.3), or for one
 * district of a metro (scoring/districts.ts: `city` is then the district's box and centre, `rotate` set).
 * Fallback: none, and the plan's pitches stand at the strongest taste cells (scoring/candidates.ts), as before OSM.
 */
export async function getOsmSpots(city: Pick<City, "bbox" | "center">, context: AdapterContext, options: { rotate?: boolean } = {}): Promise<AdapterResult<PublicSpot[]>> {
  return runAdapter<PublicSpot[]>({
    adapter: "osm",
    source: "osm",
    context,
    fallback: [],
    synthetic: () => osmSpots(syntheticOverpass(city).elements, city.bbox),
    live: () => fetchOsmSpotsRecorded(city.bbox, options.rotate),
    call: { endpoint: "/api/interpreter", params: { bbox: osmCacheKey(city.bbox).slice("osm-spots:".length) } },
  });
}

/**
 * A metro's per-district answers as one: every district's spots (each once), live when any district answered live, else
 * synthetic, else the first failure. One district failing leaves the others' spots in the plan.
 */
export function mergeOsmResults(results: readonly AdapterResult<PublicSpot[]>[]): AdapterResult<PublicSpot[]> {
  const seen = new Set<string>();
  const data = results.flatMap((r) => r.data).filter((s) => !seen.has(s.id) && seen.add(s.id));
  const best = results.find((r) => r.mode === "live") ?? results.find((r) => r.mode === "synthetic") ?? results[0];
  if (!best) return { adapter: "osm", source: "osm", mode: "live", data: [] };
  return { ...best, data };
}
