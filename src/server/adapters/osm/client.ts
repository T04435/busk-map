import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { BBox } from "@/lib/geo";
import { appVersion } from "@/lib/version";
import type { PublicSpot } from "@/server/data/spots";
import { AdapterError, fetchJson } from "../core";
import { cacheBody, cachedCall } from "../call-log";
import { buildOverpassQuery, osmCacheKey, osmSpots, overpassBBox, overpassFailed } from "./query";
import { overpassResponseSchema, type OverpassResponse } from "./schema";

/**
 * OpenStreetMap public spaces through the Overpass API (ODbL, © OpenStreetMap contributors; no key). One POST per city.
 * Cache policy: 30 days (squares and pedestrian streets barely move), so a city costs Overpass one query a month.
 *
 * Public Overpass instances go down often (502s, hangs), so the query tries each endpoint in turn: the next one on a 429,
 * a 5xx, a timeout, an unreachable host or a query stopped part-way ("runtime error" remark), all within one overall
 * deadline so a plan never waits long. A failure throws, so it is never cached.
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;
export const OVERPASS_URL = OVERPASS_ENDPOINTS[0];
/** Longest wait for one endpoint. */
export const OVERPASS_TIMEOUT_MS = 6_000;
/** Longest wait for all endpoints together. */
export const OVERPASS_DEADLINE_MS = 15_000;
/** Below this much time left, another endpoint isn't worth starting. */
const MIN_TRY_MS = 1_000;
const DAY_S = 86_400;
export const OSM_CACHE_LIFE = { stale: DAY_S, revalidate: 30 * DAY_S, expire: 30 * DAY_S } as const;

/** Overpass asks every client to say who it is. */
export function overpassUserAgent(): string {
  const repo = process.env.NEXT_PUBLIC_APP_REPO;
  return `BuskMap/${appVersion.version} (busking planner${repo ? `; ${repo}` : ""})`;
}

/**
 * The endpoint a district's query tries first: a metro's districts are queried at once, so each starts on its own endpoint
 * instead of all queueing on the first. A pure function of the rounded box, so the same district always gets the same one
 * (and the same cache key).
 */
export function endpointOffset(box: BBox): number {
  const key = osmCacheKey(box);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % OVERPASS_ENDPOINTS.length;
}

/** The endpoints in the order a query tries them, starting at `offset`. */
export const rotatedEndpoints = (offset: number): string[] => OVERPASS_ENDPOINTS.map((_, i) => OVERPASS_ENDPOINTS[(i + offset) % OVERPASS_ENDPOINTS.length]);

/**
 * The city's (or one district's) spots, recorded on the research step (a cache hit shows as a cached call). `rotate`: start
 * on the box's own endpoint (endpointOffset), for queries sent side by side.
 */
export async function fetchOsmSpotsRecorded(box: BBox, rotate = false): Promise<PublicSpot[]> {
  const b = overpassBBox(box);
  const offset = rotate ? endpointOffset(b) : 0;
  const describe = { endpoint: "/api/interpreter", params: { bbox: osmCacheKey(b).slice("osm-spots:".length) } };
  // No offset: the call (and its cache key) is the one it always was.
  return offset === 0 ? cachedCall("osm", "osm.fetchOsmSpots", [b], () => fetchOsmSpots(b), describe) : cachedCall("osm", "osm.fetchOsmSpots", [b, offset], () => fetchOsmSpots(b, offset), describe);
}

/** The query (cached 30 days by its rounded bounding box). Throws on any failure, so a failed answer is never cached. */
export async function fetchOsmSpots(box: BBox, offset?: number): Promise<PublicSpot[]> {
  "use cache: remote";
  return cacheBody("osm.fetchOsmSpots", offset === undefined ? [box] : [box, offset], async () => {
    cacheLife(OSM_CACHE_LIFE);
    cacheTag("osm");
    const body = await queryOverpass(buildOverpassQuery(box), offset ? rotatedEndpoints(offset) : OVERPASS_ENDPOINTS);
    return osmSpots(body.elements, box);
  });
}

/** Whether a failed endpoint is worth moving on from (an outage or overload, not a bad answer). */
export function tryNext(error: unknown): boolean {
  if (!(error instanceof AdapterError)) return true;
  if (error.kind === "timeout" || error.kind === "network" || error.kind === "rate_limited") return true;
  return error.kind === "http" && (error.status ?? 0) >= 500;
}

/** POST the query to each endpoint in turn until one answers in full, within OVERPASS_DEADLINE_MS. Throws the last failure. */
export async function queryOverpass(query: string, endpoints: readonly string[] = OVERPASS_ENDPOINTS): Promise<OverpassResponse> {
  const deadline = Date.now() + OVERPASS_DEADLINE_MS;
  let last: unknown = new AdapterError("osm", "timeout", `Overpass timed out after ${OVERPASS_DEADLINE_MS} ms`);
  for (const url of endpoints) {
    const left = deadline - Date.now();
    if (left < MIN_TRY_MS) break;
    const timeoutMs = Math.min(OVERPASS_TIMEOUT_MS, left);
    try {
      const body = await fetchJson(url, {
        adapter: "osm",
        schema: overpassResponseSchema,
        timeoutMs,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": overpassUserAgent() },
          body: new URLSearchParams({ data: query }).toString(),
        },
      });
      if (overpassFailed(body.remark)) throw new AdapterError("osm", "timeout", `${url} timed out after ${timeoutMs} ms (query stopped: ${body.remark?.slice(0, 120)})`);
      return body;
    } catch (error) {
      last = error;
      if (!tryNext(error)) throw error;
    }
  }
  throw last;
}
