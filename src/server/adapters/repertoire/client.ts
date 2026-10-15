import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { nameKey, songKey } from "@/lib/text";
import { env } from "@/server/env";
import { AdapterError, fetchJson } from "../core";
import {
  albumTracksSchema,
  albumsSchema,
  albumsTotalSchema,
  pickImage,
  releaseYear,
  searchSchema,
  tokenSchema,
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
const MAX_ALBUM_PAGES = 3;
const MAX_ALBUMS = 15;

// Tokens stay in this instance's memory: never in a cache entry or a log.
let token: { value: string; expiresAt: number } | undefined;

export function resetSpotifyTokenForTests() {
  token = undefined;
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

async function spotify<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  return fetchJson(`${API}${path}`, {
    adapter: "repertoire",
    schema,
    timeoutMs: TIMEOUT_MS,
    init: { headers: { Authorization: `Bearer ${await accessToken()}` } },
  });
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
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");
  const params = new URLSearchParams({ q: query, type: "track", limit: "10", market });
  const body = await spotify(`/search?${params}`, searchSchema);
  return (body.tracks?.items ?? []).filter((t): t is NonNullable<typeof t> => t !== null).map((t) => toTrack(t));
}

/**
 * The same song search scoped to one artist ("track:… artist:…"), so a
 * "sounds like" artist's own versions show even when the plain search ranks
 * them out of its first page. Five results; cached for a day like the plain search.
 */
export async function searchTracksByArtist(query: string, artist: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");
  const params = new URLSearchParams({ q: `track:${query} artist:${artist}`, type: "track", limit: "5", market });
  const body = await spotify(`/search?${params}`, searchSchema);
  return (body.tracks?.items ?? []).filter((t): t is NonNullable<typeof t> => t !== null).map((t) => toTrack(t));
}

/**
 * First release year of one song: a track search by title and artist, keeping
 * results by that artist with the same song title, and taking the earliest
 * album year (so a remaster or a best-of doesn't make an old song look new).
 * Null when Spotify has no such song. Cached for a day.
 */
export async function fetchReleaseYear(title: string, artist: string, market: string): Promise<number | null> {
  "use cache: remote";
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
}

/** Artist search. Release counts load separately (fetchReleaseCount), so a cold search answers fast. */
export async function searchArtists(query: string, market: string): Promise<CatalogueArtist[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");
  const params = new URLSearchParams({ q: query, type: "artist", limit: "10", market });
  const body = await spotify(`/search?${params}`, searchSchema);
  return (body.artists?.items ?? [])
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .map((a) => ({ id: a.id, name: a.name, image: pickImage(a.images), releases: null, url: a.external_urls?.spotify ?? null }));
}

/** Albums and singles by an artist: the `total` of a one-item albums page. Throws on failure, so failures are not cached. */
export async function fetchReleaseCount(artistId: string, market: string): Promise<number> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");
  const params = new URLSearchParams({ include_groups: "album,single", limit: "1", market });
  const body = await spotify(`/artists/${encodeURIComponent(artistId)}/albums?${params}`, albumsTotalSchema);
  return body.total;
}

/** An artist's own songs: albums and singles, deduplicated by title. */
export async function fetchArtistCatalogue(artistId: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");

  const albums: (RawAlbum & { id: string })[] = [];
  let path: string | null = `/artists/${encodeURIComponent(artistId)}/albums?${new URLSearchParams({
    include_groups: "album,single",
    limit: "10",
    market,
  })}`;
  for (let page = 0; path && page < MAX_ALBUM_PAGES; page++) {
    const body: z.infer<typeof albumsSchema> = await spotify(path, albumsSchema);
    albums.push(...body.items);
    path = body.next ? body.next.replace(API, "") : null;
  }

  const trackLists = await Promise.all(
    albums.slice(0, MAX_ALBUMS).map(async (album) => {
      const body = await spotify(`/albums/${encodeURIComponent(album.id)}/tracks?limit=50&market=${market}`, albumTracksSchema);
      return body.items.map((t) => toTrack(t, album));
    }),
  );

  const seen = new Set<string>();
  return trackLists.flat().filter((track) => {
    const key = songKey(track.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Accepts an open.spotify.com artist link, a spotify:artist: URI or a bare id. */
export function parseSpotifyArtistId(input: string): string | null {
  const value = input.trim();
  const match =
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})/.exec(value) ??
    /^spotify:artist:([A-Za-z0-9]{22})$/.exec(value) ??
    /^([A-Za-z0-9]{22})$/.exec(value);
  return match?.[1] ?? null;
}
