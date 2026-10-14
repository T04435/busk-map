import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { env } from "@/server/env";
import { AdapterError, fetchJson } from "../core";
import {
  albumTracksSchema,
  albumsSchema,
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

type RawTrack = { id: string; name: string; artists: { id: string; name: string }[]; external_urls?: { spotify?: string }; album?: { name: string } };

const toTrack = (t: RawTrack, album: string | null = t.album?.name ?? null): CatalogueTrack => ({
  id: t.id,
  title: t.name,
  artists: t.artists.map(({ id, name }) => ({ id, name })),
  album,
  url: t.external_urls?.spotify ?? null,
});

export async function searchTracks(query: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");
  const params = new URLSearchParams({ q: query, type: "track", limit: "10", market });
  const body = await spotify(`/search?${params}`, searchSchema);
  return (body.tracks?.items ?? []).filter((t): t is NonNullable<typeof t> => t !== null).map((t) => toTrack(t));
}

export async function searchArtists(query: string, market: string): Promise<CatalogueArtist[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");
  const params = new URLSearchParams({ q: query, type: "artist", limit: "10", market });
  const body = await spotify(`/search?${params}`, searchSchema);
  return (body.artists?.items ?? [])
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .map((a) => ({ id: a.id, name: a.name, url: a.external_urls?.spotify ?? null }));
}

/** Normalise a title so remasters, edits and live takes collapse into one song. */
export function songKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[-–]\s*(remaster|radio edit|live|single|mono|stereo|demo|acoustic|edit|version|mix).*$/i, "")
    .replace(/\s*[([].*?(remaster|edit|live|version|mix|deluxe|demo|mono|stereo).*?[)\]]/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** An artist's own songs: albums and singles, deduplicated by title. */
export async function fetchArtistCatalogue(artistId: string, market: string): Promise<CatalogueTrack[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("repertoire");

  const albums: { id: string; name: string }[] = [];
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
      return body.items.map((t) => toTrack(t, album.name));
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
