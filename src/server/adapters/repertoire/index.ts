import "server-only";
import { providerStatus } from "@/server/env";
import { runAdapter, settleWithLimit, type AdapterContext, type AdapterResult } from "../core";
import { fetchArtistCatalogue, fetchArtistProfile, fetchReleaseCount, fetchReleaseYear, parseSpotifyArtistId, searchArtistTracks, searchArtists, searchTracks, searchTracksByArtist } from "./client";
import {
  syntheticArtistProfile,
  syntheticArtistSearch,
  syntheticArtistTracks,
  syntheticCatalogue,
  syntheticReleaseCount,
  syntheticReleaseYear,
  syntheticScopedTrackSearch,
  syntheticTrackSearch,
} from "./fixtures/synthetic";
import { trackKey } from "@/lib/text";
import { mergeTrackLists, rankByActArtists, scopedArtistNames, MAX_SCOPED_ARTISTS } from "@/lib/track-rank";
import type { SpotifyProfile } from "@/lib/playlist-schema";
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

/**
 * Song search for "Songs you can play". With the act's "sounds like" artists,
 * it also runs one scoped search per artist (at most MAX_SCOPED_ARTISTS, in
 * parallel) and puts tracks by those artists first, keeping Spotify's order
 * within each group. A failed scoped search is skipped; the plain search decides
 * success or fallback.
 */
export async function findTracks(
  query: string,
  market: string,
  context: AdapterContext,
  actArtists: readonly string[] = [],
): Promise<AdapterResult<CatalogueTrack[]>> {
  const names = scopedArtistNames(actArtists.map((name) => ({ name, spotifyId: null })));
  const chips = names.map((name) => ({ name, spotifyId: null }));
  const combine = (plain: CatalogueTrack[], scoped: CatalogueTrack[][]) => rankByActArtists(mergeTrackLists(plain, ...scoped), chips);
  return runAdapter({
    ...common(context),
    fallback: [],
    synthetic: () => combine(syntheticTrackSearch(query), names.map((name) => syntheticScopedTrackSearch(query, name))),
    live: async () => {
      const [plain, scoped] = await Promise.all([
        searchTracks(query, market),
        settleWithLimit(names, MAX_SCOPED_ARTISTS, (name) => searchTracksByArtist(query, name, market)),
      ]);
      return combine(plain, scoped.flatMap((s) => (s.status === "fulfilled" ? [s.value] : [])));
    },
  });
}

/**
 * Artists for the "sounds like" picker: photo and name, straight from one search
 * call (`releases` is null). Release counts load afterwards with findReleaseCounts.
 */
export async function findArtists(query: string, market: string, context: AdapterContext): Promise<AdapterResult<CatalogueArtist[]>> {
  return runAdapter({ ...common(context), fallback: [], synthetic: () => syntheticArtistSearch(query), live: () => searchArtists(query, market) });
}

/**
 * An artist's songs, for the learn run's `top_tracks`. Fallback: an empty list (the run then asks Last.fm).
 */
export async function findArtistTracks(artist: string, market: string, context: AdapterContext): Promise<AdapterResult<CatalogueTrack[]>> {
  return runAdapter({ ...common(context), fallback: [], synthetic: () => syntheticArtistTracks(artist), live: () => searchArtistTracks(artist, market) });
}

/**
 * One song by one artist ("track:… artist:…", cached for a day), for the display join after a model call
 * (songs/catalogue.ts:spotifyDisplay): its Spotify id, link, cover, length and year. Fallback: an empty list.
 */
export async function findArtistTrack(title: string, artist: string, market: string, context: AdapterContext): Promise<AdapterResult<CatalogueTrack[]>> {
  return runAdapter({ ...common(context), fallback: [], synthetic: () => syntheticScopedTrackSearch(title, artist), live: () => searchTracksByArtist(title, artist, market) });
}

/** Ids per release-count lookup (one result list). */
export const MAX_RELEASE_IDS = 6;
/** Bound the fan-out (Spotify rate limits per app). */
const RELEASE_LOOKUPS_AT_ONCE = 2;

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
    call: { endpoint: "/artists/{id}/albums", params: { id: id ?? "", market } },
    live: async () => (id ? fetchArtistCatalogue(id, market) : []),
  });
}

/** Songs per release-year lookup (one plan's setlist). */
export const MAX_YEAR_SONGS = 12;
const YEAR_LOOKUPS_AT_ONCE = 2;

/**
 * First release year per song (keyed by trackKey), for era matching in the
 * setlist. Each song's year is cached on its own; songs Spotify doesn't have,
 * or whose lookup fails, are left out (no era for them).
 */
export async function findReleaseYears(
  songs: readonly { title: string; artist: string }[],
  market: string,
  context: AdapterContext,
): Promise<AdapterResult<Record<string, number>>> {
  const byKey = new Map<string, { title: string; artist: string }>();
  for (const song of songs) if (!byKey.has(trackKey(song.artist, song.title))) byKey.set(trackKey(song.artist, song.title), song);
  const unique = [...byKey.values()].slice(0, MAX_YEAR_SONGS);
  return runAdapter({
    ...common(context),
    fallback: {},
    synthetic: () => Object.fromEntries(unique.map((s) => [trackKey(s.artist, s.title), syntheticReleaseYear(s.title, s.artist)])),
    live: async () => {
      const settled = await settleWithLimit(unique, YEAR_LOOKUPS_AT_ONCE, (s) => fetchReleaseYear(s.title, s.artist, market));
      if (unique.length > 0 && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
      return Object.fromEntries(
        settled.flatMap((s, i) => (s.status === "fulfilled" && s.value !== null ? [[trackKey(unique[i].artist, unique[i].title), s.value]] : [])),
      );
    },
  });
}

/**
 * The profile header's snapshot of a Spotify artist (name, photos, genres, followers), stamped with when it was
 * fetched. Fallback: null (the Repertoire keeps whatever snapshot it already has). Called only when the link
 * changes or the performer asks to refresh: never on page load.
 */
export async function getArtistProfile(artistId: string, context: AdapterContext): Promise<AdapterResult<SpotifyProfile | null>> {
  const stamp = (raw: Awaited<ReturnType<typeof fetchArtistProfile>>): SpotifyProfile => ({ ...raw, fetchedAt: new Date().toISOString() });
  return runAdapter({
    ...common(context),
    fallback: null,
    synthetic: () => stamp(syntheticArtistProfile(artistId)),
    call: { endpoint: "/artists/{id}", params: { id: artistId } },
    live: async () => stamp(await fetchArtistProfile(artistId)),
  });
}
