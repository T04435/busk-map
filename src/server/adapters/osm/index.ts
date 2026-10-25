import "server-only";
import type { City } from "@/lib/city";
import type { PublicSpot } from "@/server/data/spots";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchOsmSpotsRecorded } from "./client";
import { syntheticOverpass } from "./fixtures/synthetic";
import { osmCacheKey, osmSpots } from "./query";

export { buildOverpassQuery, osmCacheKey, osmSpots, OSM_SPOTS_MAX } from "./query";

/**
 * Walkable public spots from OpenStreetMap for a city with no curated list (every city but Melbourne, V2 2.3).
 * Fallback: none, and the plan's pitches stand at the strongest taste cells (scoring/candidates.ts), as before OSM.
 */
export async function getOsmSpots(city: Pick<City, "bbox" | "center">, context: AdapterContext): Promise<AdapterResult<PublicSpot[]>> {
  return runAdapter<PublicSpot[]>({
    adapter: "osm",
    source: "osm",
    context,
    fallback: [],
    synthetic: () => osmSpots(syntheticOverpass(city).elements, city.bbox),
    live: () => fetchOsmSpotsRecorded(city.bbox),
    call: { endpoint: "/api/interpreter", params: { bbox: osmCacheKey(city.bbox).slice("osm-spots:".length) } },
  });
}
