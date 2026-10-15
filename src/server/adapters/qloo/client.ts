import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { wktPoint, wktPolygon, type BBox, type LatLon } from "@/lib/geo";
import { addDays } from "@/lib/slot";
import { env, type QlooBackend } from "@/server/env";
import { log } from "@/server/log";
import { QLOO_MOCK_BASE_URL, qlooMockFetch } from "@/server/qloo-mock/fetch";
import { AdapterError, fetchJson } from "../core";
import { parseEntities, toEntity, toImpact, toPlace } from "./normalize";
import {
  compareResponseSchema,
  demographicsResponseSchema,
  entitiesResponseSchema,
  heatmapResponseSchema,
  insightsEntitiesResponseSchema,
  searchResponseSchema,
  tagsResponseSchema,
  trendingResponseSchema,
  type CrowdProfile,
  type GenreContrast,
  type HeatCell,
  type LocalArtists,
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
 * Rate limits (live response headers, 2026-10-15): 5 requests a second and
 * 10,000 a month per key. Live calls are paced below the per-second limit
 * (`pace`) and a 429 is retried after a second; caching keeps the monthly
 * count down.
 *
 * Qloo silently ignores invalid parameters, so an empty result is logged with
 * the parameter names we sent: that is usually the first sign of a bad one.
 *
 * Every cached call takes the backend ("live" or "mock") as its first
 * argument, so cache entries from the local mock (src/server/qloo-mock) can
 * never be served as live data once the key arrives. In mock mode the same
 * code runs against an in-process fetch that implements Qloo's HTTP contract.
 */
/** Live calls take 1–7 s (urn:tag and large place lists are the slowest), so allow 15 s. */
const TIMEOUT_MS = 15_000;
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

/** Live requests started per rolling second. Qloo allows 5, but bursts of 4 still drew 429s when checked, and the key is shared by every instance. */
export const LIVE_REQUESTS_PER_SECOND = 3;
const RATE_RETRY_MS = 1_100;
const RATE_RETRIES = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const recentStarts: number[] = [];
let paceQueue: Promise<void> = Promise.resolve();

/** Wait for a free slot under the per-second limit. Calls are served in order. */
export function pace(perSecond = LIVE_REQUESTS_PER_SECOND): Promise<void> {
  const turn = paceQueue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (recentStarts.length > 0 && now - recentStarts[0] >= 1_000) recentStarts.shift();
      if (recentStarts.length < perSecond) {
        recentStarts.push(now);
        return;
      }
      await sleep(1_000 - (now - recentStarts[0]) + 5);
    }
  });
  paceQueue = turn;
  return turn;
}

export async function qlooGet<S extends z.ZodType>(backend: QlooBackend, path: string, params: Params, schema: S): Promise<z.infer<S>> {
  const { base, apiKey, fetcher } = target(backend);
  if (!apiKey) throw new AdapterError("qloo", "missing_key", "Qloo key is not configured");
  const query = toSearch(params);
  const once = () =>
    fetchJson(`${base}${path}?${query}`, {
      adapter: "qloo",
      schema,
      timeoutMs: TIMEOUT_MS,
      fetcher,
      init: { headers: { "X-Api-Key": apiKey, Accept: "application/json" } },
    });
  if (backend === "mock") return once();
  for (let attempt = 0; ; attempt++) {
    await pace();
    try {
      return await once();
    } catch (error) {
      if (!(error instanceof AdapterError && error.kind === "rate_limited") || attempt >= RATE_RETRIES) throw error;
      log.warn("qloo rate limited; retrying", { path, attempt: attempt + 1 });
      await sleep(RATE_RETRY_MS);
    }
  }
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

/**
 * `urn:entity:artist` liked in the area by fans of these artists, with
 * explanations: per result, and the top-level aggregate (each input artist's
 * average effect on the top 3, 5, 10 and all results).
 */
export async function localArtists(backend: QlooBackend, entityIds: string[], area: BBox, take: number): Promise<LocalArtists> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:artists");
  const params = {
    "filter.type": "urn:entity:artist",
    "signal.location": wktPolygon(area),
    "signal.interests.entities": ids(entityIds),
    "feature.explainability": entityIds.length > 0 ? true : undefined,
    take: Math.min(take, MAX_TAKE),
  };
  const body = await qlooGet(backend, "/v2/insights", params, insightsEntitiesResponseSchema);
  return {
    artists: listEntities("/v2/insights", params, body.results.entities).map(toEntity),
    impact: toImpact(body.query?.explainability),
  };
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
 * `/v2/trending` for one entity: rows newest first. The rows carry no entity
 * id, so callers ask once per artist (see `trending`). Live Qloo sends
 * `population_percentile` as a 0–1 fraction and `population_rank` as a
 * string; percentiles are returned here on a 0–100 scale.
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
  const points = (fraction: number) => Math.round(fraction * 100 * 100) / 100;
  const series = [...rows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).flatMap((row) => (row.population_percentile === undefined ? [] : [points(row.population_percentile)]));
  return {
    entityId,
    percentDelta: latest.population_percent_delta ?? null,
    velocity: latest.population_rank_velocity ?? latest.velocity_fold_change ?? null,
    percentile: latest.population_percentile === undefined ? null : points(latest.population_percentile),
    windowChange:
      latest.population_percentile !== undefined && oldest.population_percentile !== undefined && oldest !== latest
        ? Math.round((points(latest.population_percentile) - points(oldest.population_percentile)) * 100) / 100
        : null,
    series,
  };
}

/** Length of the trending window, and how far back to look for one with data. */
export const TRENDING_WINDOW_DAYS = 42;
export const TRENDING_PROBE_STEP_DAYS = 91;
export const TRENDING_MAX_PROBES = 5;

export type TrendWindow = { start: string; end: string };

/**
 * The latest trending window that has data. Live Qloo's trending is empty for
 * recent weeks (July to October 2026 when checked), so probe back a quarter
 * at a time, up to a year, with one artist. Cached for the day; each probe is
 * itself a cached `trendingFor` call, so the probe artist's row is reused.
 */
export async function trendingWindow(backend: QlooBackend, probeEntityId: string, today: string): Promise<TrendWindow | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:trending");
  for (let probe = 0; probe < TRENDING_MAX_PROBES; probe++) {
    const end = addDays(today, -1 - probe * TRENDING_PROBE_STEP_DAYS);
    const start = addDays(end, -TRENDING_WINDOW_DAYS);
    if (await trendingFor(backend, probeEntityId, start, end)) return { start, end };
  }
  return null;
}

/** `/v2/trending` for up to five artists, one request each (paced; see `qlooGet`). */
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

/** The music-genre tag subtype in /v2/analysis/compare groups. */
export const GENRE_SUBTYPE = "urn:tag:genre:music";

/**
 * `/v2/analysis/compare`: how the performer's artists (a) differ from the
 * crowd the city already gets (b), by music genre. Live Qloo lists each
 * group's tags with a count of the group's entities carrying it; a genre's
 * value per group is that count over the group's size (0–1).
 */
export async function compareGenres(backend: QlooBackend, groupA: string[], groupB: string[]): Promise<GenreContrast[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("qloo", "qloo:compare");
  const params = {
    "a.signal.interests.entities": ids(groupA),
    "b.signal.interests.entities": ids(groupB),
  };
  const body = await qlooGet(backend, "/v2/analysis/compare", params, compareResponseSchema);
  const share = (rows: typeof body.results.a, size: number) => {
    const out = new Map<string, { name: string; value: number }>();
    for (const row of rows) {
      if (row.subtype !== GENRE_SUBTYPE || !row.name) continue;
      const value = Math.min(1, (row.query?.count ?? 0) / Math.max(1, size));
      const previous = out.get(row.tag_id);
      if (!previous || value > previous.value) out.set(row.tag_id, { name: row.name, value });
    }
    return out;
  };
  const a = share(body.results.a, groupA.length);
  const b = share(body.results.b, groupB.length);
  logIfEmpty("/v2/analysis/compare", params, a.size + b.size);
  return [...new Set([...a.keys(), ...b.keys()])].map((id) => ({
    id,
    name: (a.get(id) ?? b.get(id))!.name,
    a: Math.round((a.get(id)?.value ?? 0) * 1000) / 1000,
    b: Math.round((b.get(id)?.value ?? 0) * 1000) / 1000,
  }));
}
