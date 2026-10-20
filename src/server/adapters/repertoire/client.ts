import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { nameKey, songKey } from "@/lib/text";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { AdapterError, errorKindOf, fetchJson } from "../core";
import { cacheBody, cachedCall, safeParams } from "../call-log";
import { BudgetExhausted, CallBudget, CATALOGUE_CALL_BUDGET, CATALOGUE_QUEUE_WAIT_MS, DEFAULT_RETRY_AFTER_S, MAX_QUEUE_WAIT_MS, SHORT_RETRY_AFTER_S, countSpotifyCall, limitSpotifyUntil, paceSpotify, spotifyLimitedUntil } from "./pacer";
import {
  albumTracksSchema,
  albumsBatchSchema,
  albumsSchema,
  albumsTotalSchema,
  artistSchema,
  pickImage,
  releaseYear,
  searchSchema,
  tokenSchema,
  type ArtistProfileRaw,
  type CatalogueArtist,
  type CatalogueTrack,
} from "./schema";

/**
 * Spotify Web API with app credentials (no user login, so judges are never
 * locked out by Development Mode's 5-user cap). Artist top tracks returns 403
 * since February 2026 and is not used. Search and artist albums are capped at
 * 10 per page. Cache policy: 24 hours.
 */
const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TIMEOUT_MS = 6_000;
/** Safety bound against runaway pagination (not a product cap): 50 pages of 10 albums. Spotify ends a list with next = null. */
const ALBUM_PAGES_SAFETY = 50;
/** Albums per Get Several Albums call (Spotify's maximum). */
export const ALBUMS_PER_BATCH = 20;

/** After Spotify refuses Get Several Albums, how long this instance reads albums one by one before trying the batch again. */
const BATCH_RETRY_AFTER_MS = 60 * 60_000;
let batchRefusedUntil = 0;
/** A refusal of the batch call itself (HTTP 4xx other than 429, or a response we can't read), not a rate limit or an outage. */
const batchRefused = (error: unknown) =>
  error instanceof AdapterError && (error.kind === "invalid_response" || error.kind === "not_found" || (error.kind === "http" && (error.status ?? 0) >= 400 && (error.status ?? 0) < 500));

// Tokens stay in this instance's memory: never in a cache entry or a log.
let token: { value: string; expiresAt: number } | undefined;

export function resetSpotifyTokenForTests() {
  token = undefined;
  batchRefusedUntil = 0;
}

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = env();
  if (!id || !secret) throw new AdapterError("repertoire", "missing_key", "Spotify credentials are not configured");
  const body = await fetchJson(TOKEN_URL, {
    adapter: "repertoire",
    schema: tokenSchema,
    timeoutMs: TIMEOUT_MS,
    init: {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  });
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

/**
 * Every Spotify API call goes through here: fail fast while the breaker is open (no network), count against the caller's
 * budget, wait for the pacer's slot (a caller with a budget waits up to CATALOGUE_QUEUE_WAIT_MS for it, anyone else
 * MAX_QUEUE_WAIT_MS and then fails fast with `rate_limited`), count against the app's daily cap, and on a 429 either open the breaker (Retry-After over 30 s) or wait once and retry
 * once (30 s or less). Never more than one retry.
 */
async function spotify<S extends z.ZodType>(path: string, schema: S, budget?: CallBudget, maxQueueWaitMs = MAX_QUEUE_WAIT_MS): Promise<z.infer<S>> {
  for (let attempt = 0; ; attempt++) {
    const until = await spotifyLimitedUntil();
    // The message ends like fetchJson's, so errorKindOf still reads "rate_limited" after a "use cache" boundary.
    if (until) throw new AdapterError("repertoire", "rate_limited", `Spotify is limited until ${until.toISOString()} (returned HTTP 429)`, 429);
    budget?.take();
    await paceSpotify(maxQueueWaitMs);
    await countSpotifyCall();
    try {
      return await fetchJson(`${API}${path}`, {
        adapter: "repertoire",
        schema,
        timeoutMs: TIMEOUT_MS,
        init: { headers: { Authorization: `Bearer ${await accessToken()}` } },
      });
    } catch (error) {
      if (!(error instanceof AdapterError) || error.kind !== "rate_limited") throw error;
      const wait = error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_S;
      if (wait > SHORT_RETRY_AFTER_S) {
        await limitSpotifyUntil(new Date(Date.now() + wait * 1000));
        throw error;
      }
      if (attempt >= 1) {
        // Limited again right after waiting: pause for a minute rather than keep asking.
        await limitSpotifyUntil(new Date(Date.now() + 60_000));
        throw error;
      }
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}

type RawImage = { url: string; width?: number | null };
type RawTrack = {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  duration_ms?: number;
  external_urls?: { spotify?: string };
  album?: RawAlbum;
};
type RawAlbum = { name: string; images?: RawImage[]; release_date?: string };

const toTrack = (t: RawTrack, album: RawAlbum | null = t.album ?? null): CatalogueTrack => ({
  id: t.id,
  title: t.name,
  artists: t.artists.map(({ id, name }) => ({ id, name })),
  album: album?.name ?? null,
  image: pickImage(album?.images),
  durationMs: t.duration_ms ?? null,
  url: t.external_urls?.spotify ?? null,
  year: releaseYear(album?.release_date),
});

export async function searchTracks(query: string, market: string): Promise<CatalogueTrack[]> {
  return cachedCall("spotify", "spotify.searchTracks", [query, market], () => searchTracksCached(query, market), { endpoint: "/search", params: safeParams([["q", query], ["type", "track"], ["market", market]]) });
}

async function searchTracksCached(query: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  return cacheBody("spotify.searchTracks", [query, market], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const params = new URLSearchParams({ q: query, type: "track", limit: "10", market });
    const body = await spotify(`/search?${params}`, searchSchema);
    return (body.tracks?.items ?? []).filter((t): t is NonNullable<typeof t> => t !== null).map((t) => toTrack(t));
  });
}

/**
 * The same song search scoped to one artist ("track:… artist:…"), so a
 * "sounds like" artist's own versions show even when the plain search ranks
 * them out of its first page. Five results; cached for a day like the plain search.
 */
export async function searchTracksByArtist(query: string, artist: string, market: string): Promise<CatalogueTrack[]> {
  return cachedCall("spotify", "spotify.searchTracksByArtist", [query, artist, market], () => searchTracksByArtistCached(query, artist, market), { endpoint: "/search", params: safeParams([["q", query], ["artist", artist], ["type", "track"], ["market", market]]) });
}

async function searchTracksByArtistCached(query: string, artist: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  return cacheBody("spotify.searchTracksByArtist", [query, artist, market], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const params = new URLSearchParams({ q: `track:${query} artist:${artist}`, type: "track", limit: "5", market });
    const body = await spotify(`/search?${params}`, searchSchema);
    return (body.tracks?.items ?? []).filter((t): t is NonNullable<typeof t> => t !== null).map((t) => toTrack(t));
  });
}

/**
 * An artist's songs by name: a track search scoped to the artist (`artist:"…"`, ten results, cached for a day), keeping
 * only tracks that list that artist, so a namesake's songs don't come back. Spotify's order is its relevance order, which
 * stands in for popularity: artist top tracks returns 403 (see above). Used by the learn run's `top_tracks`
 * (docs/playlist-architecture.md §2.2). Songs repeated under another edition collapse to the first.
 */
export async function searchArtistTracks(artist: string, market: string): Promise<CatalogueTrack[]> {
  return cachedCall("spotify", "spotify.searchArtistTracks", [artist, market], () => searchArtistTracksCached(artist, market), { endpoint: "/search", params: safeParams([["artist", artist], ["type", "track"], ["market", market]]) });
}

async function searchArtistTracksCached(artist: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  return cacheBody("spotify.searchArtistTracks", [artist, market], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const params = new URLSearchParams({ q: `artist:"${artist.replaceAll('"', "")}"`, type: "track", limit: "10", market });
    const body = await spotify(`/search?${params}`, searchSchema);
    const seen = new Set<string>();
    return (body.tracks?.items ?? [])
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .filter((t) => t.artists.some((a) => nameKey(a.name) === nameKey(artist)))
      .filter((t) => {
        const key = songKey(t.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((t) => toTrack(t));
  });
}

/**
 * First release year of one song: a track search by title and artist, keeping
 * results by that artist with the same song title, and taking the earliest
 * album year (so a remaster or a best-of doesn't make an old song look new).
 * Null when Spotify has no such song. Cached for a day.
 */
export async function fetchReleaseYear(title: string, artist: string, market: string): Promise<number | null> {
  return cachedCall("spotify", "spotify.fetchReleaseYear", [title, artist, market], () => fetchReleaseYearCached(title, artist, market), { endpoint: "/search", params: safeParams([["track", title], ["artist", artist], ["market", market]]) });
}

async function fetchReleaseYearCached(title: string, artist: string, market: string): Promise<number | null> {
  "use cache: remote";
  return cacheBody("spotify.fetchReleaseYear", [title, artist, market], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const params = new URLSearchParams({ q: `track:${title} artist:${artist}`, type: "track", limit: "10", market });
    const body = await spotify(`/search?${params}`, searchSchema);
    const years = (body.tracks?.items ?? [])
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .filter((t) => songKey(t.name) === songKey(title) && t.artists.some((a) => nameKey(a.name) === nameKey(artist)))
      .flatMap((t) => {
        const year = releaseYear(t.album?.release_date);
        return year === null ? [] : [year];
      });
    return years.length > 0 ? Math.min(...years) : null;
  });
}

/** Artist search. Release counts load separately (fetchReleaseCount), so a cold search answers fast. */
export async function searchArtists(query: string, market: string): Promise<CatalogueArtist[]> {
  return cachedCall("spotify", "spotify.searchArtists", [query, market], () => searchArtistsCached(query, market), { endpoint: "/search", params: safeParams([["q", query], ["type", "artist"], ["market", market]]) });
}

async function searchArtistsCached(query: string, market: string): Promise<CatalogueArtist[]> {
  "use cache: remote";
  return cacheBody("spotify.searchArtists", [query, market], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const params = new URLSearchParams({ q: query, type: "artist", limit: "10", market });
    const body = await spotify(`/search?${params}`, searchSchema);
    return (body.artists?.items ?? [])
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .map((a) => ({ id: a.id, name: a.name, image: pickImage(a.images), releases: null, url: a.external_urls?.spotify ?? null }));
  });
}

/**
 * One artist's profile: name, photos (largest first), genres and, when Spotify sends them, followers
 * (GET /v1/artists/{id}). Cached for a day; throws on failure (a 404 is `not_found`), so failures are not cached.
 * The related-artists, recommendations and audio-features endpoints are retired for new apps and never used.
 */
export async function fetchArtistProfile(artistId: string): Promise<ArtistProfileRaw> {
  return cachedCall("spotify", "spotify.fetchArtistProfile", [artistId], () => fetchArtistProfileCached(artistId), { endpoint: "/artists/{id}", params: safeParams([["id", artistId]]) });
}

async function fetchArtistProfileCached(artistId: string): Promise<ArtistProfileRaw> {
  "use cache: remote";
  return cacheBody("spotify.fetchArtistProfile", [artistId], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const body = await spotify(`/artists/${encodeURIComponent(artistId)}`, artistSchema);
    return {
      name: body.name,
      images: (body.images ?? []).slice(0, 5).map(({ url, width, height }) => ({ url, width: width ?? null, height: height ?? null })),
      genres: body.genres ?? [],
      // Spotify no longer sends followers, genres or popularity to newer apps: absent (or zero) means unknown, never "0 followers".
      ...(typeof body.followers?.total === "number" && body.followers.total > 0 ? { followers: body.followers.total } : {}),
    };
  });
}

/** Albums and singles by an artist: the `total` of a one-item albums page. Throws on failure, so failures are not cached. */
export async function fetchReleaseCount(artistId: string, market: string): Promise<number> {
  return cachedCall("spotify", "spotify.fetchReleaseCount", [artistId, market], () => fetchReleaseCountCached(artistId, market), { endpoint: "/artists/{id}/albums", params: safeParams([["id", artistId], ["market", market]]) });
}

async function fetchReleaseCountCached(artistId: string, market: string): Promise<number> {
  "use cache: remote";
  return cacheBody("spotify.fetchReleaseCount", [artistId, market], async () => {
    cacheLife("days");
    cacheTag("repertoire");
    const params = new URLSearchParams({ include_groups: "album,single", limit: "1", market });
    const body = await spotify(`/artists/${encodeURIComponent(artistId)}/albums?${params}`, albumsTotalSchema);
    return body.total;
  });
}

/**
 * An artist's own songs: albums and singles, deduplicated by title. Spotify calls: the artist's album list (10 per page),
 * then Get Several Albums (20 per call, each album with its first 50 tracks; `tracks.next` is followed only for longer
 * albums): about 39 calls for 256 releases, where one call per release took 282. The fetch has a call budget; when it is
 * used up, or Spotify rate-limits part-way, the songs found so far are returned and cached briefly. Fails (so nothing is
 * cached and the caller falls back to Last.fm) when nothing was found.
 */
export async function fetchArtistCatalogue(artistId: string, market: string): Promise<CatalogueTrack[]> {
  return cachedCall("spotify", "spotify.fetchArtistCatalogue", [artistId, market], () => fetchArtistCatalogueCached(artistId, market), { endpoint: "/artists/{id}/albums", params: safeParams([["id", artistId], ["market", market]]) });
}

async function fetchArtistCatalogueCached(artistId: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  return cacheBody("spotify.fetchArtistCatalogue", [artistId, market], async () => {
    cacheTag("repertoire");
    const budget = new CallBudget(CATALOGUE_CALL_BUDGET);
    let partial: "budget" | "limited" | "error" | null = null;
    const stop = (error: unknown) => {
      if (error instanceof BudgetExhausted) return (partial ??= "budget");
      if (error instanceof Error && "kind" in error) return (partial ??= errorKindOf(error) === "rate_limited" ? "limited" : "error");
      throw error;
    };

    const albums: (RawAlbum & { id: string })[] = [];
    let path: string | null = `/artists/${encodeURIComponent(artistId)}/albums?${new URLSearchParams({
      include_groups: "album,single",
      limit: "10",
      market,
    })}`;
    try {
      for (let page = 0; path && page < ALBUM_PAGES_SAFETY; page++) {
        const body: z.infer<typeof albumsSchema> = await spotify(path, albumsSchema, budget, CATALOGUE_QUEUE_WAIT_MS);
        albums.push(...body.items);
        path = body.next ? body.next.replace(API, "") : null;
      }
    } catch (error) {
      // The first page failing is a failed catalogue; a later page failing leaves the releases found so far.
      if (albums.length === 0) throw error;
      stop(error);
    }

    const trackLists: CatalogueTrack[][] = [];
    /** An album's first page of tracks, from either route, with its own next link. */
    type AlbumTracks = { album: RawAlbum; items: z.infer<typeof albumTracksSchema>["items"]; next: string | null };
    const take = async (found: AlbumTracks[]) => {
      for (const { album, items, next: first } of found) {
        const tracks = items.map((t) => toTrack(t, album));
        // An album longer than one page of 50 tracks is followed to its end (next = null).
        let next = first;
        try {
          for (let page = 0; next && page < ALBUM_PAGES_SAFETY; page++) {
            const more: z.infer<typeof albumTracksSchema> = await spotify(next.replace(API, ""), albumTracksSchema, budget, CATALOGUE_QUEUE_WAIT_MS);
            tracks.push(...more.items.map((t) => toTrack(t, album)));
            next = more.next ?? null;
          }
        } catch (error) {
          stop(error);
        }
        trackLists.push(tracks);
        if (partial) break;
      }
    };
    try {
      for (let from = 0; from < albums.length; from += ALBUMS_PER_BATCH) {
        const group = albums.slice(from, from + ALBUMS_PER_BATCH);
        let found: AlbumTracks[] | null = null;
        if (Date.now() >= batchRefusedUntil) {
          try {
            const params = new URLSearchParams({ ids: group.map((a) => a.id).join(","), market });
            const body: z.infer<typeof albumsBatchSchema> = await spotify(`/albums?${params}`, albumsBatchSchema, budget, CATALOGUE_QUEUE_WAIT_MS);
            found = body.albums.flatMap((album) => (album ? [{ album, items: album.tracks.items, next: album.tracks.next ?? null }] : []));
          } catch (error) {
            if (!batchRefused(error)) throw error;
            // Spotify refused the batch call itself (an endpoint closed to this app, or a shape we don't read): say why once, and
            // read the albums one by one from here on (within the call budget) instead of losing the whole catalogue.
            batchRefusedUntil = Date.now() + BATCH_RETRY_AFTER_MS;
            log.warn("spotify batch albums refused; reading albums one by one", { kind: (error as AdapterError).kind, status: (error as AdapterError).status ?? null });
          }
        }
        if (found === null) {
          found = [];
          for (const album of group) {
            try {
              const body: z.infer<typeof albumTracksSchema> = await spotify(`/albums/${encodeURIComponent(album.id)}/tracks?${new URLSearchParams({ limit: "50", market })}`, albumTracksSchema, budget, CATALOGUE_QUEUE_WAIT_MS);
              found.push({ album, items: body.items, next: body.next ?? null });
            } catch (error) {
              stop(error);
              break;
            }
          }
        }
        await take(found);
        if (partial) break;
      }
    } catch (error) {
      stop(error);
    }

    const seen = new Set<string>();
    const result = trackLists.flat().filter((track) => {
      const key = songKey(track.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Nothing found is a failed catalogue (never cached; the caller falls back to Last.fm); some found is a partial one.
    if (albums.length > 0 && result.length === 0) {
      throw partial === "limited"
        ? new AdapterError("repertoire", "rate_limited", "Spotify rate-limited every album track list (returned HTTP 429)", 429)
        : new Error("Spotify returned no album track lists");
    }
    // A whole catalogue keeps for days. A partial one never does: 10 minutes when the budget ran out, 1 minute when Spotify
    // limited us or failed part-way, so the next research gets the full list soon.
    if (partial === "budget") cacheLife({ stale: 60, revalidate: 600, expire: 600 });
    else if (partial) cacheLife({ stale: 30, revalidate: 60, expire: 60 });
    else cacheLife("days");
    return result;
  });
}

export { parseSpotifyArtistId } from "@/lib/spotify-link";
