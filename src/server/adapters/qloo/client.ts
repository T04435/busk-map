import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { wktPoint, wktPolygon, type BBox, type LatLon } from "@/lib/geo";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { AdapterError, fetchJson } from "../core";
import { parseEntities, toEntity, toPlace } from "./normalize";
import {
  demographicsResponseSchema,
  entitiesResponseSchema,
  heatmapResponseSchema,
  searchResponseSchema,
  trendingResponseSchema,
  type CrowdProfile,
  type HeatCell,
  type QlooEntity,
  type QlooPlace,
  type TrendRow,
} from "./schema";

/**
 * Qloo hackathon API client. GET with query parameters and the X-Api-Key
 * header against https://hackathon.api.qloo.com (the key does not work on the
 * production host). Every call is cached privately on the server for 24 h
 * ('use cache: remote'); responses are trimmed before caching and never
 * written to the repository.
 *
 * Qloo silently ignores invalid parameters, so an empty result is logged with
 * the parameter names we sent: that is usually the first sign of a bad one.
 */
const TIMEOUT_MS = 8_000;
export const MAX_TAKE = 50;

type Params = Record<string, string | number | boolean | undefined>;

function toSearch(params: Params): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search;
}

export async function qlooGet<S extends z.ZodType>(path: string, params: Params, schema: S): Promise<z.infer<S>> {
  const { QLOO_API_KEY: apiKey, QLOO_API_BASE_URL: base } = env();
  if (!apiKey) throw new AdapterError("qloo", "missing_key", "Qloo key is not configured");
  const query = toSearch(params);
  return fetchJson(`${base}${path}?${query}`, {
    adapter: "qloo",
    schema,
    timeoutMs: TIMEOUT_MS,
    init: { headers: { "X-Api-Key": apiKey, Accept: "application/json" } },
  });
}

export function logIfEmpty(path: string, params: Params, count: number) {
  if (count > 0) return;
  log.warn("qloo returned no results; check for an ignored parameter", {
    path,
    filterType: params["filter.type"] ?? null,
    params: Object.keys(params).filter((k) => params[k] !== undefined),
  });
}

function listEntities(path: string, params: Params, items: unknown[]) {
  const { entities, skipped } = parseEntities(items);
  if (skipped > 0) log.warn("qloo entities skipped (unexpected shape)", { path, skipped, total: items.length });
  logIfEmpty(path, params, entities.length);
  return entities;
}

const ids = (list: readonly string[]) => list.join(",");

// ---- Tool calls (spec.md, Agent design) ----------------------------------

/** `/search` for one artist name. Returns the best match, or null. */
export async function searchArtist(name: string): Promise<QlooEntity | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:search");
  const params = { query: name, types: "urn:entity:artist", take: 3 };
  const body = await qlooGet("/search", params, searchResponseSchema);
  const [best] = listEntities("/search", params, body.results);
  return best ? toEntity(best) : null;
}

/** `/entities` by Spotify artist id. */
export async function entitiesBySpotifyIds(spotifyIds: string[]): Promise<QlooEntity[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:entities");
  const params = { "external.spotify.ids": ids(spotifyIds) };
  const body = await qlooGet("/entities", params, entitiesResponseSchema);
  return listEntities("/entities", params, body.results).map(toEntity);
}

/** `urn:heatmap`: where in the area this taste concentrates. */
export async function heatmap(entityIds: string[], area: BBox): Promise<HeatCell[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:heatmap");
  const params = {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": ids(entityIds),
    "filter.location": wktPolygon(area),
  };
  const body = await qlooGet("/v2/insights", params, heatmapResponseSchema);
  logIfEmpty("/v2/insights", params, body.results.heatmap.length);
  return body.results.heatmap.map((cell) => ({
    lat: cell.location.latitude,
    lon: cell.location.longitude,
    geohash: cell.location.geohash ?? null,
    affinity: cell.query.affinity,
    affinityRank: cell.query.affinity_rank ?? null,
    popularity: cell.query.popularity ?? null,
  }));
}

/** `urn:entity:place` near a point, open on the weekday, ranked for this taste. */
export async function places(
  entityIds: string[],
  center: LatLon,
  radiusM: number,
  weekday: string,
): Promise<QlooPlace[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:places");
  const params = {
    "filter.type": "urn:entity:place",
    "filter.location": wktPoint(center),
    "filter.location.radius": radiusM,
    "filter.hours": weekday,
    "signal.interests.entities": ids(entityIds),
    take: MAX_TAKE,
  };
  const body = await qlooGet("/v2/insights", params, entitiesResponseSchema);
  return listEntities("/v2/insights", params, body.results)
    .map(toPlace)
    .filter((p): p is QlooPlace => p !== null);
}

/** `urn:entity:artist` liked in the area by fans of these artists, with explanations. */
export async function localArtists(entityIds: string[], area: BBox, take: number): Promise<QlooEntity[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:artists");
  const params = {
    "filter.type": "urn:entity:artist",
    "signal.location": wktPolygon(area),
    "signal.interests.entities": ids(entityIds),
    "feature.explainability": true,
    take: Math.min(take, MAX_TAKE),
  };
  const body = await qlooGet("/v2/insights", params, entitiesResponseSchema);
  return listEntities("/v2/insights", params, body.results).map(toEntity);
}

/** Score specific artists for the crowd around one point (`filter.results.entities`). */
export async function affinityAt(entityIds: string[], point: LatLon, radiusM: number): Promise<Record<string, number>> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:affinity");
  const params = {
    "filter.type": "urn:entity:artist",
    "filter.results.entities": ids(entityIds),
    "signal.location": wktPoint(point),
    "signal.location.radius": radiusM,
    take: Math.min(entityIds.length, MAX_TAKE),
  };
  const body = await qlooGet("/v2/insights", params, entitiesResponseSchema);
  const entities = listEntities("/v2/insights", params, body.results);
  return Object.fromEntries(
    entities.filter((e) => e.query?.affinity !== undefined).map((e) => [e.entity_id, e.query!.affinity as number]),
  );
}

/** `/v2/trending`: weekly momentum for up to five artists. */
export async function trending(entityIds: string[], startDate: string, endDate: string): Promise<TrendRow[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:trending");
  const params = {
    "signal.interests.entities": ids(entityIds.slice(0, 5)),
    "filter.type": "urn:entity:artist",
    "filter.start_date": startDate,
    "filter.end_date": endDate,
  };
  const body = await qlooGet("/v2/trending", params, trendingResponseSchema);
  logIfEmpty("/v2/trending", params, body.results.trending.length);
  // Rows are weekly; keep the latest row per entity. A row without an entity id
  // can only be attributed when we asked about a single entity.
  const latest = new Map<string, { date: string; row: TrendRow }>();
  for (const row of body.results.trending) {
    const entityId = row.entity_id ?? (entityIds.length === 1 ? entityIds[0] : null);
    if (!entityId) continue;
    const date = row.date ?? "";
    const previous = latest.get(entityId);
    if (previous && previous.date > date) continue;
    latest.set(entityId, {
      date,
      row: {
        entityId,
        percentDelta: row.population_percent_delta ?? null,
        velocity: row.population_rank_velocity ?? row.velocity_fold_change ?? null,
        percentile: row.population_percentile ?? null,
      },
    });
  }
  return [...latest.values()].map((entry) => entry.row);
}

/** `urn:demographics`: the age and gender lean of fans of these artists. */
export async function demographics(entityIds: string[]): Promise<CrowdProfile | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:demographics");
  const params = { "filter.type": "urn:demographics", "signal.interests.entities": ids(entityIds) };
  const body = await qlooGet("/v2/insights", params, demographicsResponseSchema);
  logIfEmpty("/v2/insights", params, body.results.demographics.length);
  const rows = body.results.demographics;
  if (rows.length === 0) return null;
  const average = (key: "age" | "gender") => {
    const totals: Record<string, number> = {};
    for (const row of rows) for (const [band, value] of Object.entries(row.query[key] ?? {})) totals[band] = (totals[band] ?? 0) + value / rows.length;
    return totals;
  };
  return { age: average("age"), gender: average("gender") };
}
