import "server-only";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { runAdapter, settleWithLimit, type AdapterContext, type AdapterResult } from "../core";
import { fetchArtistListenersRecorded, fetchSimilarArtistsRecorded, fetchTopTagsRecorded, fetchTopTracksRecorded } from "./client";
import { syntheticListeners, syntheticSimilar, syntheticTopTags, syntheticTopTracks } from "./fixtures/synthetic";
import type { ListenersData, SimilarArtist, SongsData, TopTag } from "./schema";

export type { ListenersData, SimilarArtist, SongsData, TopTag, TopTrack } from "./schema";

export const TOP_TRACKS_PER_ARTIST = 10;
/** Bound the fan-out to keep within Last.fm's fair-use rate. */
export const MAX_ARTISTS = 12;

/**
 * Top tracks for each artist. One artist failing leaves the others intact;
 * if every lookup fails the adapter falls back to "artist only, no song names".
 */
export async function getSongs(artists: string[], context: AdapterContext): Promise<AdapterResult<SongsData>> {
  const names = [...new Set(artists.map((a) => a.trim()).filter(Boolean))].slice(0, MAX_ARTISTS);
  return runAdapter({
    adapter: "songs",
    source: "lastfm",
    context,
    configured: providerStatus().lastfm,
    fallback: {},
    synthetic: () => Object.fromEntries(names.map((name) => [name, syntheticTopTracks(name)])),
    call: { endpoint: "artist.gettoptracks", params: { artist: names.join(", "), limit: String(TOP_TRACKS_PER_ARTIST) } },
    live: async () => {
      // Last.fm asks for about 5 requests a second: stay polite.
      const settled = await settleWithLimit(names, 4, (name) => fetchTopTracksRecorded(name, TOP_TRACKS_PER_ARTIST));
      const failures = settled.filter((s) => s.status === "rejected");
      if (names.length > 0 && failures.length === names.length) throw (failures[0] as PromiseRejectedResult).reason;
      if (failures.length > 0) log.warn("last.fm lookups failed for some artists", { failed: failures.length, total: names.length });
      return Object.fromEntries(
        settled.flatMap((s, i) => (s.status === "fulfilled" ? [[names[i], s.value]] : [])),
      );
    },
  });
}

/** Names per listener lookup (one picker result list). */
export const MAX_LISTENER_ARTISTS = 10;

/**
 * Last.fm listener counts for the artist picker, loaded after the results show.
 * Artists whose lookup fails are left out (the UI shows no count); if every
 * lookup fails the adapter falls back to no counts at all.
 */
export async function getListeners(artists: string[], context: AdapterContext): Promise<AdapterResult<ListenersData>> {
  const names = [...new Set(artists.map((a) => a.trim()).filter(Boolean))].slice(0, MAX_LISTENER_ARTISTS);
  return runAdapter({
    adapter: "songs",
    source: "lastfm",
    context,
    configured: providerStatus().lastfm,
    fallback: {},
    synthetic: () => Object.fromEntries(names.map((name) => [name, syntheticListeners(name)])),
    live: async () => {
      const settled = await settleWithLimit(names, 4, (name) => fetchArtistListenersRecorded(name));
      const failures = settled.filter((s) => s.status === "rejected");
      if (names.length > 0 && failures.length === names.length) throw (failures[0] as PromiseRejectedResult).reason;
      return Object.fromEntries(settled.flatMap((s, i) => (s.status === "fulfilled" ? [[names[i], s.value]] : [])));
    },
  });
}

export const SIMILAR_PER_ARTIST = 10;

/**
 * Last.fm artist.getSimilar for one act: one request per name (cached for weeks by the client), never more than the names given.
 * An empty list means Last.fm doesn't know the name or has no similar artists; an outage falls back to [] with mode "fallback".
 */
export async function getSimilarArtists(artist: string, context: AdapterContext): Promise<AdapterResult<SimilarArtist[]>> {
  const name = artist.trim();
  return runAdapter({
    adapter: "songs",
    source: "lastfm",
    context,
    configured: providerStatus().lastfm,
    fallback: [],
    synthetic: () => syntheticSimilar(name),
    call: { endpoint: "artist.getsimilar", params: { artist: name, limit: String(SIMILAR_PER_ARTIST) } },
    live: () => fetchSimilarArtistsRecorded(name, SIMILAR_PER_ARTIST),
  });
}

/**
 * Last.fm artist.getTopTags for one act: one request per name (cached for weeks by the client). An empty list means Last.fm
 * doesn't know the name or has no tags; an outage falls back to [] with mode "fallback".
 */
export async function getTopTags(artist: string, context: AdapterContext): Promise<AdapterResult<TopTag[]>> {
  const name = artist.trim();
  return runAdapter({
    adapter: "songs",
    source: "lastfm",
    context,
    configured: providerStatus().lastfm,
    fallback: [],
    synthetic: () => syntheticTopTags(name),
    call: { endpoint: "artist.gettoptags", params: { artist: name } },
    live: () => fetchTopTagsRecorded(name),
  });
}
