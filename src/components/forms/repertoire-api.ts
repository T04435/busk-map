"use client";

import { createLookupCache, SearchError, type SearchOutcome } from "@/lib/live-search";

/** Shapes returned by /api/repertoire (see src/server/adapters/repertoire/schema.ts). */
export type ArtistResult = { id: string; name: string; image: string | null; releases: number | null; url: string | null };
export type TrackResult = {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album: string | null;
  image: string | null;
  durationMs: number | null;
  url: string | null;
};

const OFFLINE_NOTE = "Offline test mode: these results are made up, not from Spotify.";

async function getJson(params: Record<string, string>, signal?: AbortSignal) {
  const res = await fetch(`/api/repertoire?${new URLSearchParams(params)}`, { signal });
  if (res.status === 429) throw new SearchError("Too many searches in a short time. Wait a moment and try again.");
  if (!res.ok) throw new SearchError("Search isn't working right now. Type it in instead.");
  return res.json();
}

function outcome<T>(body: { mode: string }, results: T[] | undefined): SearchOutcome<T> {
  if (body.mode === "fallback") throw new SearchError("Spotify search is unavailable right now. Type it in instead.");
  return { results: results ?? [], note: body.mode === "synthetic" ? OFFLINE_NOTE : null };
}

export async function searchArtists(q: string, signal: AbortSignal): Promise<SearchOutcome<ArtistResult>> {
  const body = await getJson({ type: "artists", q }, signal);
  return outcome(body, body.artists);
}

export async function searchTracks(q: string, signal: AbortSignal): Promise<SearchOutcome<TrackResult>> {
  const body = await getJson({ type: "tracks", q }, signal);
  return outcome(body, body.tracks);
}

/** Last.fm listeners per artist name, cached for this page's life. Missing counts stay unknown. */
const listenerCache = createLookupCache<number | null>();

export async function loadListeners(names: string[], signal: AbortSignal): Promise<Record<string, number | null>> {
  const missing = listenerCache.missing(names).filter((n) => !n.includes("|"));
  if (missing.length > 0) {
    const body = await getJson({ type: "listeners", names: missing.join("|") }, signal).catch(() => null);
    if (body && body.mode !== "fallback") {
      // Names Last.fm couldn't look up stay out of the cache, so a later search retries them.
      for (const [name, count] of Object.entries(body.listeners ?? {})) listenerCache.set(name, count as number | null);
    }
  }
  return Object.fromEntries(names.filter((n) => listenerCache.has(n)).map((n) => [n, listenerCache.get(n) ?? null]));
}
