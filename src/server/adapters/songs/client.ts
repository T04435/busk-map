import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@/server/env";
import { AdapterError, fetchJson } from "../core";
import { artistInfoSchema, similarArtistSchema, similarSchema, topTracksSchema, trackSchema, type SimilarArtist, type TopTrack } from "./schema";

/** Last.fm artist.getTopTracks, artist.getInfo and artist.getSimilar (non-commercial, credited). Cache policy: 7 days. */
const BASE = "https://ws.audioscrobbler.com/2.0/";
const TIMEOUT_MS = 5_000;
/** Last.fm error 6: artist not found. Not a failure, just no songs. */
const ARTIST_NOT_FOUND = 6;

function apiKey(): string {
  const key = env().LASTFM_API_KEY;
  if (!key) throw new AdapterError("songs", "missing_key", "Last.fm key is not configured");
  return key;
}

/** Listener count for one artist, or null when Last.fm doesn't know them. */
export async function fetchArtistListeners(artist: string): Promise<number | null> {
  "use cache: remote";
  cacheLife("weeks");
  cacheTag("songs");
  const params = new URLSearchParams({ method: "artist.getinfo", artist, autocorrect: "1", api_key: apiKey(), format: "json" });
  const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: artistInfoSchema, timeoutMs: TIMEOUT_MS });
  if ("error" in body) {
    if (body.error === ARTIST_NOT_FOUND) return null;
    throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
  }
  return body.artist.stats.listeners;
}

export async function fetchTopTracks(artist: string, limit: number): Promise<TopTrack[]> {
  "use cache: remote";
  cacheLife("weeks");
  cacheTag("songs");

  const params = new URLSearchParams({
    method: "artist.gettoptracks",
    artist,
    autocorrect: "1",
    limit: String(limit),
    api_key: apiKey(),
    format: "json",
  });
  const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: topTracksSchema, timeoutMs: TIMEOUT_MS });
  if ("error" in body) {
    if (body.error === ARTIST_NOT_FOUND) return [];
    throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
  }
  return body.toptracks.track.flatMap((raw) => {
    const track = trackSchema.safeParse(raw);
    return track.success
      ? [
          {
            title: track.data.name,
            artist: track.data.artist.name,
            playcount: track.data.playcount,
            listeners: track.data.listeners,
            url: track.data.url ?? null,
          },
        ]
      : [];
  });
}

/**
 * Last.fm artist.getSimilar: up to `limit` artists like this one, best match first; [] when Last.fm doesn't know the name
 * (error 6). Cached for weeks like the top tracks, per name and limit.
 */
export async function fetchSimilarArtists(artist: string, limit: number): Promise<SimilarArtist[]> {
  "use cache: remote";
  cacheLife("weeks");
  cacheTag("songs");
  const params = new URLSearchParams({ method: "artist.getsimilar", artist, autocorrect: "1", limit: String(limit), api_key: apiKey(), format: "json" });
  const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: similarSchema, timeoutMs: TIMEOUT_MS });
  if ("error" in body) {
    if (body.error === ARTIST_NOT_FOUND) return [];
    throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
  }
  return body.similarartists.artist.flatMap((raw) => {
    const a = similarArtistSchema.safeParse(raw);
    return a.success ? [{ name: a.data.name, match: a.data.match ?? 0 }] : [];
  });
}
