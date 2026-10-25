import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { BBox } from "@/lib/geo";
import type { NamedArea } from "@/server/scoring/areas";
import { cacheBody, cachedCall } from "../call-log";
import { endpointOffset, OSM_CACHE_LIFE, queryOverpass, rotatedEndpoints } from "../osm/client";
import { overpassBBox } from "../osm/query";
import { AREA_PLACES, areasCacheKey, buildAreasQuery, parseAreas } from "./query";

/**
 * A metro's named areas from Overpass (ODbL, © OpenStreetMap contributors; no key): one query per metro, cached 30 days by its
 * rounded box like the public spots (place names barely move). The same endpoint rotation, per-endpoint timeout and overall
 * deadline as the spots query (osm/client.ts queryOverpass); a failure throws, so it is never cached.
 */
export const areasCall = (box: BBox) => ({ endpoint: "/api/interpreter", params: { bbox: areasCacheKey(box).slice("osm-areas:".length), place: AREA_PLACES.join("|") } });

/** The areas, recorded on the research step (a cache hit shows as a cached call). */
export async function fetchNamedAreasRecorded(box: BBox): Promise<NamedArea[]> {
  const b = overpassBBox(box);
  return cachedCall("osm", "osm.fetchNamedAreas", [b], () => fetchNamedAreas(b), areasCall(b));
}

/** The query (cached 30 days by its rounded bounding box), starting on the box's own endpoint. Throws on any failure. */
export async function fetchNamedAreas(box: BBox): Promise<NamedArea[]> {
  "use cache: remote";
  return cacheBody("osm.fetchNamedAreas", [box], async () => {
    cacheLife(OSM_CACHE_LIFE);
    cacheTag("osm");
    const body = await queryOverpass(buildAreasQuery(box), rotatedEndpoints(endpointOffset(box)));
    return parseAreas(body.elements, box);
  });
}
