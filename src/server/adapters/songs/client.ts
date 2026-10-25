import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@/server/env";
import { AdapterError, fetchJson } from "../core";
import { cacheBody, cachedCall, safeParams } from "../call-log";
import { artistInfoSchema, similarArtistSchema, similarSchema, topTagSchema, topTagsSchema, topTracksSchema, trackSchema, type SimilarArtist, type TopTag, type TopTrack } from "./schema";

/** Last.fm artist.getTopTracks, artist.getInfo and artist.getSimilar (non-commercial, credited). Cache policy: 7 days. */
const BASE = "https://ws.audioscrobbler.com/2.0/";
const TIMEOUT_MS = 5_000;
/** Last.fm error 6: artist not found. Not a failure, just no songs. */
const ARTIST_NOT_FOUND = 6;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Artist-name lookups for the unknown-act fallback (getSimilar, getTopTags) start at most once a second, in order. Only cache misses reach the network, so only they wait. */
export const FALLBACK_REQUEST_GAP_MS = 1_000;
let lastStart = 0;
let paceQueue: Promise<void> = Promise.resolve();
function pace(): Promise<void> {
  const turn = paceQueue.then(async () => {
    const wait = lastStart + FALLBACK_REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
  });
  paceQueue = turn;
  return turn;
}

function apiKey(): string {
  const key = env().LASTFM_API_KEY;
  if (!key) throw new AdapterError("songs", "missing_key", "Last.fm key is not configured");
  return key;
}

/** Listener count for one artist, or null when Last.fm doesn't know them. */
export async function fetchArtistListenersRecorded(artist: string): Promise<number | null> {
  return cachedCall("lastfm", "lastfm.fetchArtistListeners", [artist], () => fetchArtistListeners(artist), { endpoint: "artist.getinfo", params: safeParams([["artist", artist]]) });
}

/** The request (cached for weeks); callers use fetchArtistListenersRecorded, which records it on the research step. */
export async function fetchArtistListeners(artist: string): Promise<number | null> {
  "use cache: remote";
  return cacheBody("lastfm.fetchArtistListeners", [artist], async () => {
    cacheLife("weeks");
    cacheTag("songs");
    const params = new URLSearchParams({ method: "artist.getinfo", artist, autocorrect: "1", api_key: apiKey(), format: "json" });
    const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: artistInfoSchema, timeoutMs: TIMEOUT_MS });
    if ("error" in body) {
      if (body.error === ARTIST_NOT_FOUND) return null;
      throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
    }
    return body.artist.stats.listeners;
  });
}

export async function fetchTopTracksRecorded(artist: string, limit: number): Promise<TopTrack[]> {
  return cachedCall("lastfm", "lastfm.fetchTopTracks", [artist, limit], () => fetchTopTracks(artist, limit), { endpoint: "artist.gettoptracks", params: safeParams([["artist", artist], ["limit", limit]]) });
}

/** The request (cached for weeks); callers use fetchTopTracksRecorded, which records it on the research step. */
export async function fetchTopTracks(artist: string, limit: number): Promise<TopTrack[]> {
  "use cache: remote";
  return cacheBody("lastfm.fetchTopTracks", [artist, limit], async () => {
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
  });
}

/**
 * Last.fm artist.getSimilar: up to `limit` artists like this one, best match first; [] when Last.fm doesn't know the name
 * (error 6). Cached for weeks like the top tracks, per name and limit.
 */
export async function fetchSimilarArtistsRecorded(artist: string, limit: number): Promise<SimilarArtist[]> {
  return cachedCall("lastfm", "lastfm.fetchSimilarArtists", [artist, limit], () => fetchSimilarArtists(artist, limit), { endpoint: "artist.getsimilar", params: safeParams([["artist", artist], ["limit", limit]]) });
}

/** The request (cached for weeks); callers use fetchSimilarArtistsRecorded, which records it on the research step. */
export async function fetchSimilarArtists(artist: string, limit: number): Promise<SimilarArtist[]> {
  "use cache: remote";
  return cacheBody("lastfm.fetchSimilarArtists", [artist, limit], async () => {
    cacheLife("weeks");
    cacheTag("songs");
    const params = new URLSearchParams({ method: "artist.getsimilar", artist, autocorrect: "1", limit: String(limit), api_key: apiKey(), format: "json" });
    await pace();
    const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: similarSchema, timeoutMs: TIMEOUT_MS });
    if ("error" in body) {
      if (body.error === ARTIST_NOT_FOUND) return [];
      throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
    }
    return body.similarartists.artist.flatMap((raw) => {
      const a = similarArtistSchema.safeParse(raw);
      return a.success ? [{ name: a.data.name, match: a.data.match ?? 0 }] : [];
    });
  });
}

/**
 * Last.fm artist.getTopTags: the tags listeners gave this artist, most used first; [] when Last.fm doesn't know the name
 * (error 6). Cached for weeks like getSimilar, per name. Used when Spotify sends no genres, to find Qloo genre tags.
 */
export async function fetchTopTagsRecorded(artist: string): Promise<TopTag[]> {
  return cachedCall("lastfm", "lastfm.fetchTopTags", [artist], () => fetchTopTags(artist), { endpoint: "artist.gettoptags", params: safeParams([["artist", artist]]) });
}

/**
 * Last.fm track.getTopTags: the tags listeners gave one track, most used first; [] when Last.fm doesn't know it (error 6). An act
 * with no artist tags often has tagged tracks. Cached for weeks, per artist and title.
 */
export async function fetchTrackTopTagsRecorded(artist: string, track: string): Promise<TopTag[]> {
  return cachedCall("lastfm", "lastfm.fetchTrackTopTags", [artist, track], () => fetchTrackTopTags(artist, track), { endpoint: "track.gettoptags", params: safeParams([["artist", artist], ["track", track]]) });
}

export async function fetchTrackTopTags(artist: string, track: string): Promise<TopTag[]> {
  "use cache: remote";
  return cacheBody("lastfm.fetchTrackTopTags", [artist, track], async () => {
    cacheLife("weeks");
    cacheTag("songs");
    const params = new URLSearchParams({ method: "track.gettoptags", artist, track, autocorrect: "1", api_key: apiKey(), format: "json" });
    await pace();
    const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: topTagsSchema, timeoutMs: TIMEOUT_MS });
    if ("error" in body) {
      if (body.error === ARTIST_NOT_FOUND) return [];
      throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
    }
    return body.toptags.tag.flatMap((raw) => {
      const t = topTagSchema.safeParse(raw);
      return t.success ? [{ name: t.data.name, count: t.data.count ?? 0 }] : [];
    });
  });
}

/** The request (cached for weeks); callers use fetchTopTagsRecorded, which records it on the research step. */
export async function fetchTopTags(artist: string): Promise<TopTag[]> {
  "use cache: remote";
  return cacheBody("lastfm.fetchTopTags", [artist], async () => {
    cacheLife("weeks");
    cacheTag("songs");
    const params = new URLSearchParams({ method: "artist.gettoptags", artist, autocorrect: "1", api_key: apiKey(), format: "json" });
    await pace();
    const body = await fetchJson(`${BASE}?${params}`, { adapter: "songs", schema: topTagsSchema, timeoutMs: TIMEOUT_MS });
    if ("error" in body) {
      if (body.error === ARTIST_NOT_FOUND) return [];
      throw new AdapterError("songs", "http", `Last.fm error ${body.error}`);
    }
    return body.toptags.tag.flatMap((raw) => {
      const t = topTagSchema.safeParse(raw);
      return t.success ? [{ name: t.data.name, count: t.data.count ?? 0 }] : [];
    });
  });
}
