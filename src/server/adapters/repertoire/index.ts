import "server-only";
import { providerStatus } from "@/server/env";
import { runAdapter, settleWithLimit, type AdapterContext, type AdapterResult } from "../core";
import { fetchArtistCatalogue, fetchReleaseCount, parseSpotifyArtistId, searchArtists, searchTracks } from "./client";
import { syntheticArtistSearch, syntheticCatalogue, syntheticReleaseCount, syntheticTrackSearch } from "./fixtures/synthetic";
import type { CatalogueArtist, CatalogueTrack } from "./schema";

export type { CatalogueArtist, CatalogueTrack } from "./schema";
export { parseSpotifyArtistId } from "./client";
export { songKey } from "@/lib/text";

/**
 * Repertoire from Spotify's catalogue. Fallback for every call: an empty list,
 * and the performer types their songs instead.
 */
const common = (context: AdapterContext) => ({
  adapter: "repertoire" as const,
  source: "spotify" as const,
  context,
  configured: providerStatus().spotify,
});

export async function findTracks(query: string, market: string, context: AdapterContext): Promise<AdapterResult<CatalogueTrack[]>> {
  return runAdapter({ ...common(context), fallback: [], synthetic: () => syntheticTrackSearch(query), live: () => searchTracks(query, market) });
}

/**
 * Artists for the "sounds like" picker: photo and name, straight from one search
 * call (`releases` is null). Release counts load afterwards with findReleaseCounts.
 */
export async function findArtists(query: string, market: string, context: AdapterContext): Promise<AdapterResult<CatalogueArtist[]>> {
  return runAdapter({ ...common(context), fallback: [], synthetic: () => syntheticArtistSearch(query), live: () => searchArtists(query, market) });
}

/** Ids per release-count lookup (one result list). */
export const MAX_RELEASE_IDS = 10;
/** Bound the fan-out (Spotify rate limits per app). */
const RELEASE_LOOKUPS_AT_ONCE = 4;

/**
 * Albums and singles per Spotify artist id, loaded after the results show.
 * Each count is cached on its own; ids whose lookup fails are left out (unknown).
 */
export async function findReleaseCounts(ids: string[], market: string, context: AdapterContext): Promise<AdapterResult<Record<string, number>>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_RELEASE_IDS);
  return runAdapter({
    ...common(context),
    fallback: {},
    synthetic: () => Object.fromEntries(unique.map((id) => [id, syntheticReleaseCount(id)])),
    live: async () => {
      const settled = await settleWithLimit(unique, RELEASE_LOOKUPS_AT_ONCE, (id) => fetchReleaseCount(id, market));
      if (unique.length > 0 && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
      return Object.fromEntries(settled.flatMap((s, i) => (s.status === "fulfilled" ? [[unique[i], s.value]] : [])));
    },
  });
}

/** A performer's own songs from their Spotify artist link. */
export async function getArtistCatalogue(
  artistLinkOrId: string,
  market: string,
  context: AdapterContext,
): Promise<AdapterResult<CatalogueTrack[]>> {
  const id = parseSpotifyArtistId(artistLinkOrId);
  return runAdapter({
    ...common(context),
    fallback: [],
    synthetic: () => syntheticCatalogue(id ?? "syn-performer"),
    live: async () => (id ? fetchArtistCatalogue(id, market) : []),
  });
}
