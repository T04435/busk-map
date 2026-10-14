import "server-only";
import type { BBox, LatLon } from "@/lib/geo";
import { qlooBackend, type QlooBackend } from "@/server/env";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import * as client from "./client";
import type { CrowdProfile, GenreContrast, HeatCell, QlooEntity, QlooPlace, TasteTag, TrendRow } from "./schema";

export type { CrowdProfile, Explanation, GenreContrast, HeatCell, QlooEntity, QlooPlace, TasteTag, TrendRow } from "./schema";

/**
 * Qloo tool functions (spec.md, Agent design). The same client code runs in
 * both modes:
 * - live: https://hackathon.api.qloo.com, when QLOO_API_KEY is set;
 * - mock: the local mock of Qloo's HTTP contract (src/server/qloo-mock), when
 *   the key is missing, QLOO_MOCK=1, or in offline test mode. Results are then
 *   reported as "synthetic" and labelled "Qloo test data (key pending)".
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

/** resolve_repertoire: artist names to Qloo entities (null when Qloo has no match). */
export function resolveArtists(names: string[], context: AdapterContext): Promise<AdapterResult<ResolvedArtist[]>> {
  const byKey = new Map<string, string>();
  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  }
  const unique = [...byKey.values()].slice(0, MAX_ARTISTS);
  return run(
    context,
    unique.map((query) => ({ query, entity: null })),
    async (backend) => {
      const settled = await Promise.allSettled(unique.map((name) => client.searchArtist(backend, name)));
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

/** local_artists: what this crowd likes, with explainability. */
export function localArtists(entityIds: string[], area: BBox, take: number, context: AdapterContext): Promise<AdapterResult<QlooEntity[]>> {
  return run(context, [], (backend) => client.localArtists(backend, entityIds, area, take));
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
