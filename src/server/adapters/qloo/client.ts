import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { wktPoint, wktPolygon, type BBox, type LatLon } from "@/lib/geo";
import { env, type QlooBackend } from "@/server/env";
import { log } from "@/server/log";
import { QLOO_MOCK_BASE_URL, qlooMockFetch } from "@/server/qloo-mock/fetch";
import { AdapterError, fetchJson } from "../core";
import { parseEntities, toEntity, toPlace } from "./normalize";
import {
  compareResponseSchema,
  demographicsResponseSchema,
  entitiesResponseSchema,
  heatmapResponseSchema,
  searchResponseSchema,
  tagsResponseSchema,
  trendingResponseSchema,
  type CrowdProfile,
  type GenreContrast,
  type HeatCell,
  type QlooEntity,
  type QlooPlace,
  type TasteTag,
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
 *
 * Every cached call takes the backend ("live" or "mock") as its first
 * argument, so cache entries from the local mock (src/server/qloo-mock) can
 * never be served as live data once the key arrives. In mock mode the same
 * code runs against an in-process fetch that implements Qloo's HTTP contract.
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

function target(backend: QlooBackend) {
  if (backend === "mock") return { base: QLOO_MOCK_BASE_URL, apiKey: "mock-key", fetcher: qlooMockFetch };
  const { QLOO_API_KEY: apiKey, QLOO_API_BASE_URL: base } = env();
  return { base, apiKey, fetcher: undefined };
}

export async function qlooGet<S extends z.ZodType>(backend: QlooBackend, path: string, params: Params, schema: S): Promise<z.infer<S>> {
  const { base, apiKey, fetcher } = target(backend);
  if (!apiKey) throw new AdapterError("qloo", "missing_key", "Qloo key is not configured");
  const query = toSearch(params);
  return fetchJson(`${base}${path}?${query}`, {
    adapter: "qloo",
    schema,
    timeoutMs: TIMEOUT_MS,
    fetcher,
    init: { headers: { "X-Api-Key": apiKey, Accept: "application/json" } },
  });
}

/** /search and /entities answer 404 "No results" when nothing matches (docs): that is not an outage. */
async function orNotFound<T>(load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof AdapterError && error.kind === "not_found") return empty;
    throw error;
  }
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
export async function searchArtist(backend: QlooBackend, name: string): Promise<QlooEntity | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:search");
  const params = { query: name, types: "urn:entity:artist", take: 3 };
  const results = await orNotFound(async () => (await qlooGet(backend, "/search", params, searchResponseSchema)).results, []);
  const [best] = listEntities("/search", params, results);
  return best ? toEntity(best) : null;
}

/** `/entities` by Spotify artist id. */
export async function entitiesBySpotifyIds(backend: QlooBackend, spotifyIds: string[]): Promise<QlooEntity[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:entities");
  const params = { "external.spotify.ids": ids(spotifyIds) };
  const results = await orNotFound(async () => (await qlooGet(backend, "/entities", params, entitiesResponseSchema)).results, []);
  return listEntities("/entities", params, results).map(toEntity);
}

/** `urn:heatmap`: where in the area this taste concentrates. */
export async function heatmap(backend: QlooBackend, entityIds: string[], area: BBox): Promise<HeatCell[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:heatmap");
  const params = {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": ids(entityIds),
    "filter.location": wktPolygon(area),
  };
  const body = await qlooGet(backend, "/v2/insights", params, heatmapResponseSchema);
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

/**
 * `urn:entity:place` near a point, ranked for this taste. With a weekday, only
 * places open that day (filter.hours); with null, all places (the week planner
 * then checks opening hours per slot).
 */
export async function places(
  backend: QlooBackend,
  entityIds: string[],
  center: LatLon,
  radiusM: number,
  weekday: string | null,
): Promise<QlooPlace[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:places");
  const params = {
    "filter.type": "urn:entity:place",
    "filter.location": wktPoint(center),
    "filter.location.radius": radiusM,
    "filter.hours": weekday ?? undefined,
    "signal.interests.entities": ids(entityIds),
    take: MAX_TAKE,
  };
  const body = await qlooGet(backend, "/v2/insights", params, entitiesResponseSchema);
  return listEntities("/v2/insights", params, body.results)
    .map(toPlace)
    .filter((p): p is QlooPlace => p !== null);
}

/** `urn:entity:artist` liked in the area by fans of these artists, with explanations. */
export async function localArtists(backend: QlooBackend, entityIds: string[], area: BBox, take: number): Promise<QlooEntity[]> {
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
  const body = await qlooGet(backend, "/v2/insights", params, entitiesResponseSchema);
  return listEntities("/v2/insights", params, body.results).map(toEntity);
}

/** Score specific artists for the crowd around one point (`filter.results.entities`). */
export async function affinityAt(backend: QlooBackend, entityIds: string[], point: LatLon, radiusM: number): Promise<Record<string, number>> {
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
  const body = await qlooGet(backend, "/v2/insights", params, entitiesResponseSchema);
  const entities = listEntities("/v2/insights", params, body.results);
  return Object.fromEntries(
    entities.filter((e) => e.query?.affinity !== undefined).map((e) => [e.entity_id, e.query!.affinity as number]),
  );
}

/**
 * `/v2/trending` for one entity: weekly rows, newest first. The docs describe
 * a single entity's series and the rows carry no entity id, so callers ask
 * once per artist (see `trending`).
 */
export async function trendingFor(backend: QlooBackend, entityId: string, startDate: string, endDate: string): Promise<TrendRow | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:trending");
  const params = {
    "signal.interests.entities": entityId,
    "filter.type": "urn:entity:artist",
    "filter.start_date": startDate,
    "filter.end_date": endDate,
  };
  const body = await qlooGet(backend, "/v2/trending", params, trendingResponseSchema);
  logIfEmpty("/v2/trending", params, body.results.trending.length);
  const rows = body.results.trending.filter((row) => row.entity_id === undefined || row.entity_id === entityId);
  const [latest] = [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (!latest) return null;
  const oldest = rows.reduce((min, row) => ((row.date ?? "") < (min.date ?? "") ? row : min), latest);
  const series = [...rows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).flatMap((row) => (row.population_percentile === undefined ? [] : [row.population_percentile]));
  return {
    entityId,
    percentDelta: latest.population_percent_delta ?? null,
    velocity: latest.population_rank_velocity ?? latest.velocity_fold_change ?? null,
    percentile: latest.population_percentile ?? null,
    windowChange:
      latest.population_percentile !== undefined && oldest.population_percentile !== undefined && oldest !== latest
        ? Math.round((latest.population_percentile - oldest.population_percentile) * 100) / 100
        : null,
    series,
  };
}

/** `/v2/trending` for up to five artists, one request each, in parallel. */
export async function trending(backend: QlooBackend, entityIds: string[], startDate: string, endDate: string): Promise<TrendRow[]> {
  const settled = await Promise.allSettled(entityIds.slice(0, 5).map((id) => trendingFor(backend, id, startDate, endDate)));
  if (settled.length > 0 && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  return settled.flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []));
}

/** `urn:demographics`: the age and gender lean of fans of these artists. */
export async function demographics(backend: QlooBackend, entityIds: string[]): Promise<CrowdProfile | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:demographics");
  const params = { "filter.type": "urn:demographics", "signal.interests.entities": ids(entityIds) };
  const body = await qlooGet(backend, "/v2/insights", params, demographicsResponseSchema);
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

/**
 * `urn:tag` taste analysis: the music genres that characterise fans of these
 * artists around a point (signal.location), strongest first.
 */
export async function crowdTags(backend: QlooBackend, entityIds: string[], point: LatLon, radiusM: number, take: number): Promise<TasteTag[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:tags");
  const params = {
    "filter.type": "urn:tag",
    "filter.tag.types": "urn:tag:genre:music",
    "filter.parents.types": "urn:entity:artist",
    "signal.interests.entities": ids(entityIds),
    "signal.location": wktPoint(point),
    "signal.location.radius": radiusM,
    take: Math.min(take, MAX_TAKE),
  };
  const body = await qlooGet(backend, "/v2/insights", params, tagsResponseSchema);
  logIfEmpty("/v2/insights", params, body.results.tags.length);
  return body.results.tags.map((tag) => ({ id: tag.tag_id ?? tag.id ?? "", name: tag.name, affinity: tag.query?.affinity ?? null })).filter((t) => t.id);
}

/**
 * `/v2/analysis/compare` by genre: how the performer's fans (a) differ from
 * the crowd the city already gets (b). The response shape is not documented
 * in detail; rows without both affinities are skipped.
 */
export async function compareGenres(backend: QlooBackend, groupA: string[], groupB: string[]): Promise<GenreContrast[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:compare");
  const params = {
    "a.signal.interests.entities": ids(groupA),
    "b.signal.interests.entities": ids(groupB),
    "filter.type": "urn:entity:artist",
    "filter.subtype": "urn:tag:genre",
    take: 20,
  };
  const body = await qlooGet(backend, "/v2/analysis/compare", params, compareResponseSchema);
  logIfEmpty("/v2/analysis/compare", params, body.results.length);
  return body.results.flatMap((row) => {
    const a = row.query?.a?.affinity;
    const b = row.query?.b?.affinity;
    return a === undefined || b === undefined ? [] : [{ id: row.tag_id ?? row.id ?? row.name, name: row.name, a, b }];
  });
}
