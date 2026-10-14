import "server-only";
import type { BBox, LatLon } from "@/lib/geo";
import { providerStatus } from "@/server/env";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import * as client from "./client";
import * as syn from "./fixtures/synthetic";
import type { CrowdProfile, HeatCell, QlooEntity, QlooPlace, TrendRow } from "./schema";

export type { CrowdProfile, Explanation, HeatCell, QlooEntity, QlooPlace, TrendRow } from "./schema";

/**
 * Qloo tool functions (spec.md, Agent design). Live when QLOO_API_KEY is set;
 * until then, labelled synthetic data so the rest of the app can be built.
 * Fallback when the key is set but Qloo fails: empty data, and the plan
 * reports a clear Qloo error (Qloo is required; architecture.md).
 */
function run<T>(context: AdapterContext, fallback: T, synthetic: () => T, live: () => Promise<T>): Promise<AdapterResult<T>> {
  return runAdapter({
    adapter: "qloo",
    source: "qloo",
    context,
    configured: providerStatus().qloo,
    whenUnconfigured: "synthetic",
    fallback,
    synthetic,
    live,
  });
}

/** Whether Qloo calls will be live or synthetic. Safe to render. */
export function qlooMode(context: AdapterContext): "live" | "synthetic" {
  return !context.offline && providerStatus().qloo ? "live" : "synthetic";
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
    () => unique.map((query) => ({ query, entity: syn.synSearchArtist(query) })),
    async () => {
      const settled = await Promise.allSettled(unique.map((name) => client.searchArtist(name)));
      if (unique.length > 0 && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
      return unique.map((query, i) => ({ query, entity: settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<QlooEntity | null>).value : null }));
    },
  );
}

/** resolve_repertoire by Spotify id, where Qloo's external-id lookup works. */
export function resolveSpotifyArtists(spotifyIds: string[], context: AdapterContext): Promise<AdapterResult<QlooEntity[]>> {
  return run(context, [], () => spotifyIds.map((id) => syn.synSearchArtist(`Spotify ${id}`)), () => client.entitiesBySpotifyIds(spotifyIds));
}

/** taste_map: heatmap cells for the performer's artists over the area. */
export function tasteMap(entityIds: string[], area: BBox, context: AdapterContext): Promise<AdapterResult<HeatCell[]>> {
  return run(context, [], () => syn.synHeatmap(entityIds, area), () => client.heatmap(entityIds, area));
}

/** busy_places: places near a point that are open on the slot's weekday. */
export function busyPlaces(
  entityIds: string[],
  center: LatLon,
  radiusM: number,
  weekday: string,
  context: AdapterContext,
): Promise<AdapterResult<QlooPlace[]>> {
  return run(context, [], () => syn.synPlaces(entityIds, center, radiusM, weekday), () => client.places(entityIds, center, radiusM, weekday));
}

/** local_artists: what this crowd likes, with explainability. */
export function localArtists(entityIds: string[], area: BBox, take: number, context: AdapterContext): Promise<AdapterResult<QlooEntity[]>> {
  return run(context, [], () => syn.synLocalArtists(entityIds, take), () => client.localArtists(entityIds, area, take));
}

/** Per-pitch affinity of the performer's artists, for setlist ordering. */
export function artistAffinityAt(
  entityIds: string[],
  point: LatLon,
  radiusM: number,
  context: AdapterContext,
): Promise<AdapterResult<Record<string, number>>> {
  return run(context, {}, () => syn.synAffinityAt(entityIds, point), () => client.affinityAt(entityIds, point, radiusM));
}

/** rising: momentum for candidate artists, for "learn these". */
export function rising(entityIds: string[], startDate: string, endDate: string, context: AdapterContext): Promise<AdapterResult<TrendRow[]>> {
  return run(context, [], () => syn.synTrending(entityIds), () => client.trending(entityIds, startDate, endDate));
}

/** crowd_profile: age and gender lean of fans of these artists. */
export function crowdProfile(entityIds: string[], context: AdapterContext): Promise<AdapterResult<CrowdProfile | null>> {
  return run<CrowdProfile | null>(context, null, () => syn.synDemographics(entityIds), () => client.demographics(entityIds));
}
