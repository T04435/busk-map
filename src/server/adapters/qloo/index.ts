import "server-only";
import type { BBox, LatLon } from "@/lib/geo";
import { qlooBackend, type QlooBackend } from "@/server/env";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import * as client from "./client";
import type { CrowdProfile, EntityDetail, GenreContrast, HeatCell, LocalArtists, QlooEntity, QlooPlace, TasteTag, TrendRow } from "./schema";

export type { CrowdProfile, EntityDetail, Explanation, GenreContrast, HeatCell, Impact, LocalArtists, QlooEntity, QlooPlace, TasteTag, TrendRow } from "./schema";
export type { TrendWindow } from "./client";
/** Requests the trending window probe may send at most (a quarter back at a time). */
export const TRENDING_PROBES = client.TRENDING_MAX_PROBES;

/**
 * Qloo tool functions (spec.md, Agent design). The same client code runs in
 * both modes:
 * - live: https://hackathon.api.qloo.com, when QLOO_API_KEY is set;
 * - mock: the local mock of Qloo's HTTP contract (src/server/qloo-mock), when
 *   the key is missing, QLOO_MOCK=1, or in offline test mode. Results are then
 *   reported as "synthetic" and labelled "Qloo test data (local mock)".
 * When Qloo fails, the fallback is empty data and the plan reports a clear
 * Qloo error (Qloo is required; architecture.md).
 */
function run<T>(context: AdapterContext, fallback: T, call: (backend: QlooBackend) => Promise<T>): Promise<AdapterResult<T>> {
  const backend = qlooBackend(context.offline);
  return runAdapter({
    adapter: "qloo",
    source: "qloo",
    // The mock is a real HTTP contract, so it runs through the live path (errors included).
    context: { ...context, offline: false },
    fallback,
    synthetic: () => fallback,
    live: () => call(backend),
  }).then((result) => (backend === "mock" && result.mode === "live" ? { ...result, mode: "synthetic" } : result));
}

/** Whether Qloo calls will be live or answered by the local mock. Safe to render. */
export function qlooMode(context: AdapterContext): "live" | "synthetic" {
  return qlooBackend(context.offline) === "live" ? "live" : "synthetic";
}

/** Bound the fan-out of /search calls per plan. */
export const MAX_ARTISTS = 10;

export type ResolvedArtist = { query: string; entity: QlooEntity | null };

/**
 * resolve_repertoire: artist names to Qloo entities (null when Qloo has no match).
 * Artists picked from Spotify search carry their Spotify id: Qloo's external-id
 * lookup (`/entities?external.spotify.ids=`) is tried first, as it can't pick the
 * wrong namesake; the name search is the fallback when the id finds nothing or fails.
 */
export function resolveArtists(
  names: string[],
  context: AdapterContext,
  spotifyArtists: readonly { name: string; id: string }[] = [],
): Promise<AdapterResult<ResolvedArtist[]>> {
  const byKey = new Map<string, string>();
  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  }
  const unique = [...byKey.values()].slice(0, MAX_ARTISTS);
  const spotifyIdOf = new Map(spotifyArtists.map((a) => [a.name.trim().toLowerCase(), a.id]));
  return run(
    context,
    unique.map((query) => ({ query, entity: null })),
    async (backend) => {
      const resolveOne = async (name: string): Promise<QlooEntity | null> => {
        const spotifyId = spotifyIdOf.get(name.toLowerCase());
        if (spotifyId) {
          const [byId] = await client.entitiesBySpotifyIds(backend, [spotifyId]).catch(() => []);
          if (byId) return byId;
        }
        return client.searchArtist(backend, name);
      };
      const settled = await Promise.allSettled(unique.map(resolveOne));
      if (unique.length > 0 && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
      return unique.map((query, i) => ({ query, entity: settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<QlooEntity | null>).value : null }));
    },
  );
}

/** resolve_repertoire by Spotify id, where Qloo's external-id lookup works. */
export function resolveSpotifyArtists(spotifyIds: string[], context: AdapterContext): Promise<AdapterResult<QlooEntity[]>> {
  return run(context, [], (backend) => client.entitiesBySpotifyIds(backend, spotifyIds));
}

/** taste_map: heatmap cells for the performer's artists over the area. */
export function tasteMap(entityIds: string[], area: BBox, context: AdapterContext): Promise<AdapterResult<HeatCell[]>> {
  return run(context, [], (backend) => client.heatmap(backend, entityIds, area));
}

/** busy_places: places near a point, open on the slot's weekday (or any day, with null). */
export function busyPlaces(
  entityIds: string[],
  center: LatLon,
  radiusM: number,
  weekday: string | null,
  context: AdapterContext,
): Promise<AdapterResult<QlooPlace[]>> {
  return run(context, [], (backend) => client.places(backend, entityIds, center, radiusM, weekday));
}

/** local_artists: what this crowd likes, with explainability (per result and aggregate). */
export function localArtists(entityIds: string[], area: BBox, take: number, context: AdapterContext): Promise<AdapterResult<LocalArtists>> {
  return run<LocalArtists>(context, { artists: [], impact: [] }, (backend) => client.localArtists(backend, entityIds, area, take));
}

/** taste_artists: artists whose fans overlap these artists' fans, anywhere, with explainability (the learn run's related_artists). */
export function tasteArtists(entityIds: string[], take: number, context: AdapterContext): Promise<AdapterResult<LocalArtists>> {
  return run<LocalArtists>(context, { artists: [], impact: [] }, (backend) => client.tasteArtists(backend, entityIds, take));
}

/** Per-pitch affinity of the performer's artists, for setlist ordering. */
export function artistAffinityAt(
  entityIds: string[],
  point: LatLon,
  radiusM: number,
  context: AdapterContext,
): Promise<AdapterResult<Record<string, number>>> {
  return run(context, {}, (backend) => client.affinityAt(backend, entityIds, point, radiusM));
}

/** Affinity of other artists (an event's headliners) with the taste of the performer's artists. */
export function tasteMatch(resultIds: string[], signalIds: string[], context: AdapterContext): Promise<AdapterResult<Record<string, number>>> {
  return run(context, {}, (backend) => client.affinityFor(backend, resultIds, signalIds));
}

/** The latest trending window with data (probing back from today), or null when Qloo has none in the last year. */
export function trendingWindow(probeEntityId: string, today: string, context: AdapterContext): Promise<AdapterResult<client.TrendWindow | null>> {
  return run<client.TrendWindow | null>(context, null, (backend) => client.trendingWindow(backend, probeEntityId, today));
}

/** rising: momentum for candidate artists, for "learn these". */
export function rising(entityIds: string[], startDate: string, endDate: string, context: AdapterContext): Promise<AdapterResult<TrendRow[]>> {
  return run(context, [], (backend) => client.trending(backend, entityIds, startDate, endDate));
}

/** crowd_profile: age and gender lean of fans of these artists. */
export function crowdProfile(entityIds: string[], context: AdapterContext): Promise<AdapterResult<CrowdProfile | null>> {
  return run<CrowdProfile | null>(context, null, (backend) => client.demographics(backend, entityIds));
}

/** crowd_tags: the genres that characterise this crowd around a pitch (urn:tag). */
export function crowdTags(entityIds: string[], point: LatLon, radiusM: number, take: number, context: AdapterContext): Promise<AdapterResult<TasteTag[]>> {
  return run(context, [], (backend) => client.crowdTags(backend, entityIds, point, radiusM, take));
}

/** contrast: how the performer's fans differ from another group, by genre (/v2/analysis/compare). */
export function compareGenres(groupA: string[], groupB: string[], context: AdapterContext): Promise<AdapterResult<GenreContrast[]>> {
  return run(context, [], (backend) => client.compareGenres(backend, groupA, groupB));
}

/** global_pop: Qloo's globally popular artists (no signal), the reference set the local scene's genre over-index is measured against. */
export function globalArtists(take: number, context: AdapterContext): Promise<AdapterResult<QlooEntity[]>> {
  return run<QlooEntity[]>(context, [], (backend) => client.globalArtists(backend, take));
}

/** local_scene: artists liked in the city area and tagged with its over-indexed genres (no artist signal). */
export function sceneArtists(tagIds: string[], area: BBox, take: number, context: AdapterContext): Promise<AdapterResult<QlooEntity[]>> {
  return run<QlooEntity[]>(context, [], (backend) => client.sceneArtists(backend, tagIds, area, take));
}

/** artist_detail: one artist's own Qloo profile (typed tags, description), for Repertoire research step 3. */
export function artistDetail(entityId: string, context: AdapterContext): Promise<AdapterResult<EntityDetail | null>> {
  return run<EntityDetail | null>(context, null, (backend) => client.entityDetail(backend, entityId));
}

/** act_genres: the music genres fans of these artists lean to, anywhere (Repertoire research step 8). */
export function actGenres(entityIds: string[], take: number, context: AdapterContext): Promise<AdapterResult<TasteTag[]>> {
  return run<TasteTag[]>(context, [], (backend) => client.artistGenres(backend, entityIds, take));
}
