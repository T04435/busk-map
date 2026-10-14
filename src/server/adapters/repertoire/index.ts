import "server-only";
import { providerStatus } from "@/server/env";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchArtistCatalogue, parseSpotifyArtistId, searchArtists, searchTracks } from "./client";
import { syntheticArtistSearch, syntheticCatalogue, syntheticTrackSearch } from "./fixtures/synthetic";
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

export async function findArtists(query: string, market: string, context: AdapterContext): Promise<AdapterResult<CatalogueArtist[]>> {
  return runAdapter({ ...common(context), fallback: [], synthetic: () => syntheticArtistSearch(query), live: () => searchArtists(query, market) });
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
