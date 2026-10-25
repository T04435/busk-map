import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { BBox } from "@/lib/geo";
import { appVersion } from "@/lib/version";
import type { PublicSpot } from "@/server/data/spots";
import { AdapterError, fetchJson } from "../core";
import { cacheBody, cachedCall } from "../call-log";
import { buildOverpassQuery, osmCacheKey, osmSpots, overpassBBox, overpassFailed } from "./query";
import { overpassResponseSchema } from "./schema";

/**
 * OpenStreetMap public spaces through the Overpass API (ODbL, © OpenStreetMap contributors; no key). One POST per city.
 * Cache policy: 30 days (squares and pedestrian streets barely move), so a city costs Overpass one query a month.
 */
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OVERPASS_TIMEOUT_MS = 10_000;
const DAY_S = 86_400;
export const OSM_CACHE_LIFE = { stale: DAY_S, revalidate: 30 * DAY_S, expire: 30 * DAY_S } as const;

/** Overpass asks every client to say who it is. */
export function overpassUserAgent(): string {
  const repo = process.env.NEXT_PUBLIC_APP_REPO;
  return `BuskMap/${appVersion.version} (busking planner${repo ? `; ${repo}` : ""})`;
}

/** The city's spots, recorded on the research step (a cache hit shows as a cached call). */
export async function fetchOsmSpotsRecorded(box: BBox): Promise<PublicSpot[]> {
  const b = overpassBBox(box);
  return cachedCall("osm", "osm.fetchOsmSpots", [b], () => fetchOsmSpots(b), { endpoint: "/api/interpreter", params: { bbox: osmCacheKey(b).slice("osm-spots:".length) } });
}

/** The query (cached 30 days by its rounded bounding box). Throws on any failure, so a failed answer is never cached. */
export async function fetchOsmSpots(box: BBox): Promise<PublicSpot[]> {
  "use cache: remote";
  return cacheBody("osm.fetchOsmSpots", [box], async () => {
    cacheLife(OSM_CACHE_LIFE);
    cacheTag("osm");
    const body = await fetchJson(OVERPASS_URL, {
      adapter: "osm",
      schema: overpassResponseSchema,
      timeoutMs: OVERPASS_TIMEOUT_MS,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": overpassUserAgent() },
        body: new URLSearchParams({ data: buildOverpassQuery(box) }).toString(),
      },
    });
    if (overpassFailed(body.remark)) throw new AdapterError("osm", "timeout", `${OVERPASS_URL} timed out after ${OVERPASS_TIMEOUT_MS} ms (query stopped: ${body.remark?.slice(0, 120)})`);
    return osmSpots(body.elements, box);
  });
}
