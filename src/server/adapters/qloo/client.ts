import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { wktPoint, wktPolygon, type BBox, type LatLon } from "@/lib/geo";
import { addDays } from "@/lib/slot";
import { env, type QlooBackend } from "@/server/env";
import { log } from "@/server/log";
import { QLOO_MOCK_BASE_URL, qlooMockFetch } from "@/server/qloo-mock/fetch";
import { takeQlooCall } from "./budget";
import { countLookup, lookupScope, noteQlooRequest } from "./usage";
import { AdapterError, errorKindOf, fetchJson } from "../core";
import { parseEntities, toDetail, toEntity, toImpact, toPlace } from "./normalize";
import { tagVia, untagVia, type MaybeVia } from "./via";
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
  type EntityDetail,
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
 *
 * NotOnQ (lib/notonq.ts): with QLOO_PROXY_BASE_URL set, every live request goes to that drop-in proxy first (same path, query
 * and key, plus `X-NotOnQ-App`), and straight to QLOO_API_BASE_URL when the proxy times out, can't be reached, answers 5xx or
 * 429, or sends something that isn't Qloo's shape (`proxyFallback`). Qloo's own 400 and 404, which the proxy passes through, are
 * answers, not failures. The response shape is Qloo's either way, so cache keys don't change; NotOnQ's provenance rides in the
 * response (its `notonq` block, "Not in Qloo" entities), which a direct answer never has, so a fallback is never labelled NotOnQ.
 */
/** Live calls take 1–7 s (urn:tag and large place lists are the slowest), so allow 15 s. */
const TIMEOUT_MS = 15_000;
/**
 * The proxy's own, shorter limit: it fills artists from open sources on a first request, so it may be slower than Qloo, but a
 * hung proxy must leave time for the direct call. 12 s, then Qloo direct gets its full 15 s.
 */
export const PROXY_TIMEOUT_MS = 12_000;
/** The app label NotOnQ's Ledger records the calls under (its docs: `X-NotOnQ-App`). */
export const NOTONQ_APP = "busk-map";
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
  if (backend === "mock") return { base: QLOO_MOCK_BASE_URL, apiKey: "mock-key", fetcher: qlooMockFetch, proxy: null };
  const { QLOO_API_KEY: apiKey, QLOO_API_BASE_URL: base, QLOO_PROXY_BASE_URL: proxy } = env();
  return { base, apiKey, fetcher: undefined, proxy: proxy ?? null };
}

/**
 * Whether a failed proxy request is retried straight against Qloo: a timeout, a dropped connection, a 5xx (NotOnQ's 502 "Qloo
 * didn't answer" included), a 429 (NotOnQ's daily budget for this key, or Qloo's limit) or a response that isn't Qloo's shape.
 * Not Qloo's own 400 or 404 passed through (Qloo direct would say the same), nor a 401.
 */
export function proxyFallback(error: unknown): boolean {
  const kind = errorKindOf(error);
  if (kind === "timeout" || kind === "network" || kind === "rate_limited" || kind === "invalid_response") return true;
  return kind === "http" && isServerError(error);
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
  const { base, apiKey, fetcher, proxy } = target(backend);
  if (!apiKey) throw new AdapterError("qloo", "missing_key", "Qloo key is not configured");
  const query = toSearch(params);
  const headers = { "X-Api-Key": apiKey, Accept: "application/json" };
  const direct = () => {
    noteQlooRequest();
    return fetchJson(`${base}${path}?${query}`, { adapter: "qloo", schema, timeoutMs: TIMEOUT_MS, fetcher, init: { headers } });
  };
  // Through NotOnQ first when it is configured (live only), then Qloo direct. The daily budget and the pace are taken once per
  // logical call (below), so a fallback doesn't charge the budget twice; both HTTP requests count as requests sent (usage.ts).
  const once = !proxy
    ? direct
    : async () => {
        noteQlooRequest();
        try {
          return await fetchJson(`${proxy}${path}?${query}`, { adapter: "qloo", schema, timeoutMs: PROXY_TIMEOUT_MS, fetcher, init: { headers: { ...headers, "X-NotOnQ-App": NOTONQ_APP } } });
        } catch (error) {
          if (!proxyFallback(error)) throw error;
          log.warn("notonq proxy failed; asking Qloo directly", { path, kind: errorKindOf(error), status: error instanceof AdapterError ? (error.status ?? null) : null });
          return direct();
        }
      };
  if (backend === "mock") return once();
  for (let attempt = 0; ; attempt++) {
    await takeQlooCall();
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

/** A server error (HTTP 5xx), a timeout or a dropped connection: worth one more try. */
export function isServerError(error: unknown): boolean {
  const kind = errorKindOf(error);
  if (kind === "timeout" || kind === "network") return true;
  if (kind !== "http") return false;
  const status = error instanceof AdapterError && error.status ? error.status : Number(/returned HTTP (\d{3})/.exec(error instanceof Error ? error.message : String(error))?.[1] ?? 0);
  return status >= 500;
}

/** One retry of a call that failed with a server error (isServerError), after a short pause. Other errors throw at once. */
export async function retryOnceOnServerError<T>(load: () => Promise<T>, path: string, pauseMs = 400): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isServerError(error)) throw error;
    log.warn("qloo server error; retrying once", { path, kind: errorKindOf(error) });
    await sleep(pauseMs);
    return load();
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

/** Qloo entity ids fit for a signal or a results filter: trimmed, non-empty, with no comma (the list separator) or space, once each. */
export function entitySignal(entityIds: readonly string[]): string[] {
  return [...new Set(entityIds.map((id) => id.trim()).filter((id) => /^[^\s,]+$/.test(id)))];
}

/**
 * Qloo answers a request with nothing valid to go on with 400 "at least one valid signal or filter is required for entity
 * insights". Such a request is never sent: the call throws this typed "no signal" error instead (no Qloo request, no quota),
 * and index.ts turns it into empty data with `reason: "no_signal"`, which is not an outage.
 */
function noSignal(call: string): never {
  throw new AdapterError("qloo", "no_signal", `Qloo ${call} skipped: ${NO_SIGNAL_MESSAGE}`);
}
export const NO_SIGNAL_MESSAGE = "no valid signal or filter to send";
/**
 * Genre tags sent beside the entities (`signal.interests.tags`): the act's genres when Qloo doesn't know the act. A lookup
 * key gains them only when there are some, so a call without tags keeps the key (and the cached answer) it always had.
 */
const withTags = (tags: readonly string[] | undefined): [readonly string[]] | [] => (tags?.length ? [tags] : []);

// ---- Tool calls (spec.md, Agent design) ----------------------------------

/**
 * `/search` for one artist name: its (at most three) hits, best first. Callers take the first, or weigh them all (the matcher in
 * lib/qloo-match.ts, which asks the performer when none is certain).
 */
export async function searchArtist(backend: QlooBackend, name: string): Promise<QlooEntity[]> {
  const found = await countLookup("searchArtist", [backend, name], () => searchArtistCached(backend, name));
  // A value cached before this call kept every hit holds one entity (or null).
  return Array.isArray(found) ? found : found ? [found] : [];
}

async function searchArtistCached(backend: QlooBackend, name: string): Promise<QlooEntity[]> {
  "use cache: remote";
  return lookupScope("searchArtist", [backend, name], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:search");
    const params = { query: name, types: "urn:entity:artist", take: 3 };
    const results = await orNotFound(async () => (await qlooGet(backend, "/search", params, searchResponseSchema)).results, []);
    const found = listEntities("/search", params, results).map(toEntity);
    // Qloo's catalogue grows with its model updates: "not on Qloo" is remembered for hours, not days, so a new act is found soon.
    if (found.length === 0) cacheLife("hours");
    return found;
  });
}

/** `/entities` by Spotify artist id. */
export async function entitiesBySpotifyIds(backend: QlooBackend, spotifyIds: string[]): Promise<QlooEntity[]> {
  return countLookup("entitiesBySpotifyIds", [backend, spotifyIds], () => entitiesBySpotifyIdsCached(backend, spotifyIds));
}

async function entitiesBySpotifyIdsCached(backend: QlooBackend, spotifyIds: string[]): Promise<QlooEntity[]> {
  "use cache: remote";
  return lookupScope("entitiesBySpotifyIds", [backend, spotifyIds], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:entities");
    const params = { "external.spotify.ids": ids(spotifyIds) };
    const results = await orNotFound(async () => (await qlooGet(backend, "/entities", params, entitiesResponseSchema)).results, []);
    const found = listEntities("/entities", params, results).map(toEntity);
    if (found.length === 0) cacheLife("hours");
    return found;
  });
}

/**
 * `/entities` by Qloo id: one artist's own profile (Repertoire research, step 3). The resolver's lookups keep only what the
 * plan needs; this reads the entity's typed tags (genres and the rest) and its description.
 */
export async function entityDetail(backend: QlooBackend, entityId: string): Promise<EntityDetail | null> {
  return countLookup("entityDetail", [backend, entityId], () => entityDetailCached(backend, entityId));
}

async function entityDetailCached(backend: QlooBackend, entityId: string): Promise<EntityDetail | null> {
  "use cache: remote";
  return lookupScope("entityDetail", [backend, entityId], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:entities");
    const params = { entity_ids: entityId };
    const results = await orNotFound(async () => (await qlooGet(backend, "/entities", params, entitiesResponseSchema)).results, []);
    const [first] = listEntities("/entities", params, results);
    return first ? toDetail(first) : null;
  });
}

export type HeatmapBoundary = "city" | "neighborhood";

/** `urn:heatmap`: where in the area this taste concentrates. */
/** `boundary` (U40): Qloo's `output.heatmap.boundary` (documented values "city" and "neighborhood"); omitted, cells are geohash squares. */
export async function heatmap(backend: QlooBackend, rawIds: string[], area: BBox, boundary?: HeatmapBoundary, tagIds: readonly string[] = []): Promise<HeatCell[]> {
  const tags = sceneTags(tagIds);
  const entityIds = entitySignal(rawIds);
  if (entityIds.length === 0 && tags.length === 0) noSignal("heatmap");
  return countLookup("heatmap", [backend, entityIds, area, boundary ?? null, ...withTags(tags)], () =>
    tags.length ? heatmapCached(backend, entityIds, area, boundary, tags) : heatmapCached(backend, entityIds, area, boundary),
  ).then(untagVia);
}

async function heatmapCached(backend: QlooBackend, entityIds: string[], area: BBox, boundary?: HeatmapBoundary, tagIds?: string[]): Promise<MaybeVia<HeatCell[]>> {
  "use cache: remote";
  return lookupScope("heatmap", [backend, entityIds, area, boundary ?? null, ...withTags(tagIds)], async () => {
    // A world-sized area is the Repertoire's "Where your fans are": fresh for 24 h. City-sized areas (the planner) keep "days".
    if (area.east - area.west > 180 || area.north - area.south > 120) cacheLife({ stale: 3600, revalidate: 86400, expire: 86400 });
    else cacheLife("days");
    cacheTag("qloo", "qloo:heatmap");
    const params = {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": ids(entityIds),
      "signal.interests.tags": tagIds?.length ? ids(tagIds) : undefined,
      "filter.location": wktPolygon(area),
      ...(boundary ? { "output.heatmap.boundary": boundary } : {}),
    };
    const body = await qlooGet(backend, "/v2/insights", params, heatmapResponseSchema);
    logIfEmpty("/v2/insights", params, body.results.heatmap.length);
    const cells = body.results.heatmap.map((cell) => ({
      lat: cell.location.latitude,
      lon: cell.location.longitude,
      geohash: cell.location.geohash ?? null,
      affinity: cell.query.affinity,
      affinityRank: cell.query.affinity_rank ?? null,
      popularity: cell.query.popularity ?? null,
    }));
    return tagVia(cells, body.notonq);
  });
}

/**
 * `urn:entity:place` near a point, ranked for this taste. With a weekday, only
 * places open that day (filter.hours); with null, all places (the week planner
 * then checks opening hours per slot).
 */
export async function places(
  backend: QlooBackend,
  rawIds: string[],
  center: LatLon,
  radiusM: number,
  weekday: string | null,
  tagIds: readonly string[] = [],
): Promise<QlooPlace[]> {
  const tags = sceneTags(tagIds);
  const entityIds = entitySignal(rawIds);
  // Places are ranked for a taste: with no artist and no genre there is nothing to rank by (and Qloo may refuse the call).
  if (entityIds.length === 0 && tags.length === 0) noSignal("places");
  return countLookup("places", [backend, entityIds, center, radiusM, weekday, ...withTags(tags)], () =>
    tags.length ? placesCached(backend, entityIds, center, radiusM, weekday, tags) : placesCached(backend, entityIds, center, radiusM, weekday),
  ).then(untagVia);
}

async function placesCached(
  backend: QlooBackend,
  entityIds: string[],
  center: LatLon,
  radiusM: number,
  weekday: string | null,
  tagIds?: string[],
): Promise<MaybeVia<QlooPlace[]>> {
  "use cache: remote";
  return lookupScope("places", [backend, entityIds, center, radiusM, weekday, ...withTags(tagIds)], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:places");
    const params = {
      "filter.type": "urn:entity:place",
      "filter.location": wktPoint(center),
      "filter.location.radius": radiusM,
      "filter.hours": weekday ?? undefined,
      "signal.interests.entities": ids(entityIds),
      "signal.interests.tags": tagIds?.length ? ids(tagIds) : undefined,
      take: MAX_TAKE,
    };
    const body = await qlooGet(backend, "/v2/insights", params, entitiesResponseSchema);
    const found = listEntities("/v2/insights", params, body.results)
      .map(toPlace)
      .filter((p): p is QlooPlace => p !== null);
    return tagVia(found, body.notonq);
  });
}

/**
 * `urn:entity:artist` liked in the area by fans of these artists, with
 * explanations: per result, and the top-level aggregate (each input artist's
 * average effect on the top 3, 5, 10 and all results).
 */
export async function localArtists(backend: QlooBackend, rawIds: string[], area: BBox, take: number, tagIds: readonly string[] = []): Promise<LocalArtists> {
  const tags = sceneTags(tagIds);
  // The area is the location signal, so this call always has one; the act's artists and genres sharpen it when present.
  const entityIds = entitySignal(rawIds);
  return countLookup("localArtists", [backend, entityIds, area, take, ...withTags(tags)], () =>
    tags.length ? localArtistsCached(backend, entityIds, area, take, tags) : localArtistsCached(backend, entityIds, area, take),
  ).then(untagVia);
}

async function localArtistsCached(backend: QlooBackend, entityIds: string[], area: BBox, take: number, tagIds?: string[]): Promise<MaybeVia<LocalArtists>> {
  "use cache: remote";
  return lookupScope("localArtists", [backend, entityIds, area, take, ...withTags(tagIds)], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:artists");
    const params = {
      "filter.type": "urn:entity:artist",
      "signal.location": wktPolygon(area),
      "signal.interests.entities": ids(entityIds),
      "signal.interests.tags": tagIds?.length ? ids(tagIds) : undefined,
      "feature.explainability": entityIds.length > 0 ? true : undefined,
      take: Math.min(take, MAX_TAKE),
    };
    const body = await qlooGet(backend, "/v2/insights", params, insightsEntitiesResponseSchema);
    return tagVia({ artists: listEntities("/v2/insights", params, body.results.entities).map(toEntity), impact: toImpact(body.query?.explainability) }, body.notonq);
  });
}

/**
 * `urn:entity:artist` liked by fans of these artists anywhere (no location signal), with explainability: which of the
 * input artists explain each result. The learn run's `related_artists` (docs/playlist-architecture.md §2.2, call #12).
 */
export async function tasteArtists(backend: QlooBackend, rawIds: string[], take: number): Promise<LocalArtists> {
  const entityIds = entitySignal(rawIds);
  if (entityIds.length === 0) noSignal("taste artists");
  return countLookup("tasteArtists", [backend, entityIds, take], () => tasteArtistsCached(backend, entityIds, take)).then(untagVia);
}

async function tasteArtistsCached(backend: QlooBackend, entityIds: string[], take: number): Promise<MaybeVia<LocalArtists>> {
  "use cache: remote";
  return lookupScope("tasteArtists", [backend, entityIds, take], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:artists");
    const params = {
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": ids(entityIds),
      "feature.explainability": true,
      take: Math.min(take, MAX_TAKE),
    };
    const body = await qlooGet(backend, "/v2/insights", params, insightsEntitiesResponseSchema);
    return tagVia({ artists: listEntities("/v2/insights", params, body.results.entities).map(toEntity), impact: toImpact(body.query?.explainability) }, body.notonq);
  });
}

/**
 * `urn:entity:artist` with no taste signal, only a popularity floor: Qloo's globally popular artists, the "global-pop set" that
 * `/v2/analysis/compare` measures a city's crowd against (local scene, step 1). The same answer for every city, so it is
 * fetched once per cache lifetime and shared by all busks.
 */
/** The popularity floor (0–1) of the global-pop set: Qloo's most popular artists. */
export const GLOBAL_POP_MIN_POPULARITY = 0.9;

export async function globalArtists(backend: QlooBackend, take: number): Promise<QlooEntity[]> {
  return countLookup("globalArtists", [backend, take], () => globalArtistsCached(backend, take));
}

async function globalArtistsCached(backend: QlooBackend, take: number): Promise<QlooEntity[]> {
  "use cache: remote";
  return lookupScope("globalArtists", [backend, take], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:artists");
    // Qloo refuses an artist request with no signal and no filter ("at least one valid signal or filter is required for entity
    // insights"), so the global-pop set is asked for as what it is: the most popular artists, by a popularity filter.
    const params = { "filter.type": "urn:entity:artist", "filter.popularity.min": GLOBAL_POP_MIN_POPULARITY, take: Math.min(take, MAX_TAKE) };
    const body = await qlooGet(backend, "/v2/insights", params, insightsEntitiesResponseSchema);
    return listEntities("/v2/insights", params, body.results.entities).map(toEntity);
  });
}

/**
 * The local scene (step 2): `urn:entity:artist` liked in the city area AND tagged with the city's over-indexed genres
 * (`signal.interests.tags`), with no artist signal. Location plus genre tag works where location plus the act's artists
 * does not: the act swamps the location (research/cities/cities.md, "WHAT: options tested"). Shared by every act in
 * the city, so it is cached per city and tags.
 */
export async function sceneArtists(backend: QlooBackend, tagIds: string[], area: BBox, take: number): Promise<QlooEntity[]> {
  const tags = sceneTags(tagIds);
  // Nothing valid to send: Qloo answers a tag-less or malformed signal with "at least one valid signal or filter is required".
  if (tags.length === 0) noSignal("local scene");
  return countLookup("sceneArtists", [backend, tags, area, take], () => sceneArtistsCached(backend, tags, area, take));
}

/** Tag ids fit for `signal.interests.tags`: trimmed `urn:tag:` ids with no comma (the list separator), once each, at most 7. */
export function sceneTags(tagIds: readonly string[]): string[] {
  return [...new Set(tagIds.map((t) => t.trim()).filter((t) => /^urn:tag:[^\s,]+$/.test(t)))].slice(0, 7);
}

async function sceneArtistsCached(backend: QlooBackend, tagIds: string[], area: BBox, take: number): Promise<QlooEntity[]> {
  "use cache: remote";
  return lookupScope("sceneArtists", [backend, tagIds, area, take], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:artists");
    const ask = async (tags: string[]) => {
      const params = {
        "filter.type": "urn:entity:artist",
        "signal.location": wktPolygon(area),
        "signal.interests.tags": ids(tags),
        take: Math.min(take, MAX_TAKE),
      };
      const body = await qlooGet(backend, "/v2/insights", params, insightsEntitiesResponseSchema);
      return listEntities("/v2/insights", params, body.results.entities).map(toEntity);
    };
    const refused = (error: unknown) => error instanceof AdapterError && error.status === 400;
    try {
      return await ask(tagIds);
    } catch (error) {
      if (!refused(error)) throw error;
      log.warn("qloo refused the local scene tags", { tags: tagIds });
    }
    // One tag Qloo does not know can void the whole list: try the strongest handle alone, then give up (an honest "no local artists").
    if (tagIds.length > 1) {
      try {
        return await ask(tagIds.slice(0, 1));
      } catch (error) {
        if (!refused(error)) throw error;
        log.warn("qloo refused the strongest local scene tag", { tags: tagIds.slice(0, 1) });
      }
    }
    return [];
  });
}

/** Score specific artists for the crowd around one point (`filter.results.entities`). */
export async function affinityAt(backend: QlooBackend, rawIds: string[], point: LatLon, radiusM: number): Promise<Record<string, number>> {
  const entityIds = entitySignal(rawIds);
  if (entityIds.length === 0) noSignal("affinity at a point");
  return countLookup("affinityAt", [backend, entityIds, point, radiusM], () => affinityAtCached(backend, entityIds, point, radiusM)).then(untagVia);
}

async function affinityAtCached(backend: QlooBackend, entityIds: string[], point: LatLon, radiusM: number): Promise<MaybeVia<Record<string, number>>> {
  "use cache: remote";
  return lookupScope("affinityAt", [backend, entityIds, point, radiusM], async () => {
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
    return tagVia(Object.fromEntries(entities.filter((e) => e.query?.affinity !== undefined).map((e) => [e.entity_id, e.query!.affinity as number])), body.notonq);
  });
}

/**
 * How well other artists suit the taste of the performer's artists: Qloo
 * affinity of `resultIds` given `signalIds` (no location). Used to weigh an
 * event's crowd by how close its headliner's fans are to the performer's.
 */
export async function affinityFor(backend: QlooBackend, rawResults: string[], rawSignal: string[]): Promise<Record<string, number>> {
  const resultIds = entitySignal(rawResults);
  const signalIds = entitySignal(rawSignal);
  if (resultIds.length === 0 || signalIds.length === 0) noSignal("taste match");
  return countLookup("affinityFor", [backend, resultIds, signalIds], () => affinityForCached(backend, resultIds, signalIds)).then(untagVia);
}

async function affinityForCached(backend: QlooBackend, resultIds: string[], signalIds: string[]): Promise<MaybeVia<Record<string, number>>> {
  "use cache: remote";
  return lookupScope("affinityFor", [backend, resultIds, signalIds], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:affinity");
    const params = {
      "filter.type": "urn:entity:artist",
      "filter.results.entities": ids(resultIds),
      "signal.interests.entities": ids(signalIds),
      take: Math.min(resultIds.length, MAX_TAKE),
    };
    const body = await qlooGet(backend, "/v2/insights", params, entitiesResponseSchema);
    const entities = listEntities("/v2/insights", params, body.results);
    return tagVia(Object.fromEntries(entities.filter((e) => e.query?.affinity !== undefined).map((e) => [e.entity_id, e.query!.affinity as number])), body.notonq);
  });
}

/**
 * `/v2/trending` for one entity: rows newest first. The rows carry no entity
 * id, so callers ask once per artist (see `trending`). Live Qloo sends
 * `population_percentile` as a 0–1 fraction and `population_rank` as a
 * string; percentiles are returned here on a 0–100 scale.
 */
export async function trendingFor(backend: QlooBackend, rawId: string, startDate: string, endDate: string): Promise<TrendRow | null> {
  const [entityId] = entitySignal([rawId]);
  if (!entityId) noSignal("trending");
  return countLookup("trendingFor", [backend, entityId, startDate, endDate], () => trendingForCached(backend, entityId, startDate, endDate));
}

async function trendingForCached(backend: QlooBackend, entityId: string, startDate: string, endDate: string): Promise<TrendRow | null> {
  "use cache: remote";
  return lookupScope("trendingFor", [backend, entityId, startDate, endDate], async () => {
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
  });
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
  return countLookup("trendingWindow", [backend, probeEntityId, today], () => trendingWindowCached(backend, probeEntityId, today));
}

async function trendingWindowCached(backend: QlooBackend, probeEntityId: string, today: string): Promise<TrendWindow | null> {
  "use cache: remote";
  return lookupScope("trendingWindow", [backend, probeEntityId, today], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:trending");
    for (let probe = 0; probe < TRENDING_MAX_PROBES; probe++) {
      const end = addDays(today, -1 - probe * TRENDING_PROBE_STEP_DAYS);
      const start = addDays(end, -TRENDING_WINDOW_DAYS);
      if (await trendingFor(backend, probeEntityId, start, end)) return { start, end };
    }
    return null;
  });
}

/** `/v2/trending` for up to five artists, one request each (paced; see `qlooGet`). */
export async function trending(backend: QlooBackend, entityIds: string[], startDate: string, endDate: string): Promise<TrendRow[]> {
  const settled = await Promise.allSettled(entityIds.slice(0, 5).map((id) => trendingFor(backend, id, startDate, endDate)));
  if (settled.length > 0 && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  return settled.flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []));
}

/** `urn:demographics`: the age and gender lean of fans of these artists. */
export async function demographics(backend: QlooBackend, rawIds: string[], tagIds: readonly string[] = []): Promise<CrowdProfile | null> {
  const tags = sceneTags(tagIds);
  const entityIds = entitySignal(rawIds);
  if (entityIds.length === 0 && tags.length === 0) noSignal("demographics");
  return countLookup("demographics", [backend, entityIds, ...withTags(tags)], () => (tags.length ? demographicsCached(backend, entityIds, tags) : demographicsCached(backend, entityIds))).then(untagVia);
}

async function demographicsCached(backend: QlooBackend, entityIds: string[], tagIds?: string[]): Promise<MaybeVia<CrowdProfile | null>> {
  "use cache: remote";
  return lookupScope("demographics", [backend, entityIds, ...withTags(tagIds)], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:demographics");
    const params = { "filter.type": "urn:demographics", "signal.interests.entities": ids(entityIds), "signal.interests.tags": tagIds?.length ? ids(tagIds) : undefined };
    const body = await qlooGet(backend, "/v2/insights", params, demographicsResponseSchema);
    logIfEmpty("/v2/insights", params, body.results.demographics.length);
    const rows = body.results.demographics;
    if (rows.length === 0) return null;
    const average = (key: "age" | "gender") => {
      const totals: Record<string, number> = {};
      for (const row of rows) for (const [band, value] of Object.entries(row.query[key] ?? {})) totals[band] = (totals[band] ?? 0) + value / rows.length;
      return totals;
    };
    return tagVia({ age: average("age"), gender: average("gender") }, body.notonq);
  });
}

/**
 * `urn:tag` taste analysis: the music genres that characterise fans of these
 * artists around a point (signal.location), strongest first.
 */
export async function crowdTags(backend: QlooBackend, rawIds: string[], point: LatLon, radiusM: number, take: number): Promise<TasteTag[]> {
  // The point is the location signal, so this call always has one; the act's artists sharpen it when present.
  const entityIds = entitySignal(rawIds);
  return countLookup("crowdTags", [backend, entityIds, point, radiusM, take], () => crowdTagsCached(backend, entityIds, point, radiusM, take)).then(untagVia);
}

async function crowdTagsCached(backend: QlooBackend, entityIds: string[], point: LatLon, radiusM: number, take: number): Promise<MaybeVia<TasteTag[]>> {
  "use cache: remote";
  return lookupScope("crowdTags", [backend, entityIds, point, radiusM, take], async () => {
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
    return tagVia(body.results.tags.map((tag) => ({ id: tag.tag_id ?? tag.id ?? "", name: tag.name, affinity: tag.query?.affinity ?? null })).filter((t) => t.id), body.notonq);
  });
}

/**
 * `urn:tag` taste analysis with no location: the music genres that characterise fans of these artists anywhere, strongest
 * first (Repertoire research, step 8: "Your sound in genres").
 */
export async function artistGenres(backend: QlooBackend, rawIds: string[], take: number): Promise<TasteTag[]> {
  const entityIds = entitySignal(rawIds);
  if (entityIds.length === 0) noSignal("act genres");
  return countLookup("artistGenres", [backend, entityIds, take], () => artistGenresCached(backend, entityIds, take)).then(untagVia);
}

async function artistGenresCached(backend: QlooBackend, entityIds: string[], take: number): Promise<MaybeVia<TasteTag[]>> {
  "use cache: remote";
  return lookupScope("artistGenres", [backend, entityIds, take], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:tags");
    const params = {
      "filter.type": "urn:tag",
      "filter.tag.types": "urn:tag:genre:music",
      "filter.parents.types": "urn:entity:artist",
      "signal.interests.entities": ids(entityIds),
      take: Math.min(take, MAX_TAKE),
    };
    const body = await qlooGet(backend, "/v2/insights", params, tagsResponseSchema);
    logIfEmpty("/v2/insights", params, body.results.tags.length);
    return tagVia(body.results.tags.map((tag) => ({ id: tag.tag_id ?? tag.id ?? "", name: tag.name, affinity: tag.query?.affinity ?? null })).filter((t) => t.id), body.notonq);
  });
}

/**
 * `/v2/tags` search: music-genre tags whose name matches the text (an act's Spotify genre, "indie folk"), best first. Used when
 * Qloo doesn't know the act, to turn its genres into `urn:tag:genre…` ids. 404 "No results" is an empty list.
 */
export type GenreTagTypes = "urn:tag:genre:music" | "urn:tag:genre";
/** `types` "urn:tag:genre" also returns Qloo's own genre tags (urn:tag:genre:qloo:reggaeton), which the music filter leaves out. */
export async function searchGenreTags(backend: QlooBackend, text: string, take: number, types: GenreTagTypes = "urn:tag:genre:music"): Promise<TasteTag[]> {
  const args = types === "urn:tag:genre:music" ? [backend, text, take] : [backend, text, take, types];
  return countLookup("searchGenreTags", args, () => searchGenreTagsCached(backend, text, take, types));
}

async function searchGenreTagsCached(backend: QlooBackend, text: string, take: number, types: GenreTagTypes): Promise<TasteTag[]> {
  "use cache: remote";
  const args = types === "urn:tag:genre:music" ? [backend, text, take] : [backend, text, take, types];
  return lookupScope("searchGenreTags", args, async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:tags");
    const params = { "filter.query": text, "filter.tag.types": types, take: Math.min(take, MAX_TAKE) };
    // A 5xx or a timeout is tried once more (live, 25 Oct: one /v2/tags 502 lost an act's genres). A failure throws, so it isn't cached.
    const body = await orNotFound(() => retryOnceOnServerError(() => qlooGet(backend, "/v2/tags", params, tagsResponseSchema), "/v2/tags"), { results: { tags: [] } });
    logIfEmpty("/v2/tags", params, body.results.tags.length);
    return body.results.tags.map((tag) => ({ id: tag.tag_id ?? tag.id ?? "", name: tag.name, affinity: null })).filter((t) => t.id);
  });
}

/**
 * `urn:entity:artist` liked by people who like these genre tags (`signal.interests.tags`, no artist signal, no location): the
 * signal for an act Qloo doesn't know. Tag ids are checked like the local scene's (sceneTags).
 */
export async function tagArtists(backend: QlooBackend, tagIds: string[], take: number): Promise<QlooEntity[]> {
  const tags = sceneTags(tagIds);
  if (tags.length === 0) noSignal("tag artists");
  return countLookup("tagArtists", [backend, tags, take], () => tagArtistsCached(backend, tags, take));
}

async function tagArtistsCached(backend: QlooBackend, tagIds: string[], take: number): Promise<QlooEntity[]> {
  "use cache: remote";
  return lookupScope("tagArtists", [backend, tagIds, take], async () => {
    cacheLife("days");
    cacheTag("qloo", "qloo:artists");
    const params = { "filter.type": "urn:entity:artist", "signal.interests.tags": ids(tagIds), take: Math.min(take, MAX_TAKE) };
    try {
      const body = await qlooGet(backend, "/v2/insights", params, insightsEntitiesResponseSchema);
      return listEntities("/v2/insights", params, body.results.entities).map(toEntity);
    } catch (error) {
      // Qloo refuses a tag list with one tag it doesn't know: an honest "no artists", not an outage.
      if (error instanceof AdapterError && error.status === 400) return [];
      throw error;
    }
  });
}

/** The music-genre tag subtype in /v2/analysis/compare groups. */
export const GENRE_SUBTYPE = "urn:tag:genre:music";

/**
 * `/v2/analysis/compare`: how the performer's artists (a) differ from the
 * crowd the city already gets (b), by music genre. Live Qloo lists each
 * group's tags with a count of the group's entities carrying it; a genre's
 * value per group is that count over the group's size (0–1).
 */
export async function compareGenres(backend: QlooBackend, rawA: string[], rawB: string[]): Promise<GenreContrast[]> {
  const groupA = entitySignal(rawA);
  const groupB = entitySignal(rawB);
  if (groupA.length === 0 || groupB.length === 0) noSignal("compare");
  return countLookup("compareGenres", [backend, groupA, groupB], () => compareGenresCached(backend, groupA, groupB)).then(untagVia);
}

async function compareGenresCached(backend: QlooBackend, groupA: string[], groupB: string[]): Promise<MaybeVia<GenreContrast[]>> {
  "use cache: remote";
  return lookupScope("compareGenres", [backend, groupA, groupB], async () => {
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
    const rows = [...new Set([...a.keys(), ...b.keys()])].map((id) => ({
      id,
      name: (a.get(id) ?? b.get(id))!.name,
      a: Math.round((a.get(id)?.value ?? 0) * 1000) / 1000,
      b: Math.round((b.get(id)?.value ?? 0) * 1000) / 1000,
    }));
    return tagVia(rows, body.notonq);
  });
}
