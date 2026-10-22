import "server-only";
import { nameKey, songKey } from "@/lib/text";
import type { AdapterContext } from "@/server/adapters/core";
import { findArtistTrack, findArtistTracks } from "@/server/adapters/repertoire";
import { getSongs } from "@/server/adapters/songs";

/**
 * One song of an artist's catalogue. The candidate list comes from Last.fm only: Spotify's Developer Terms (v10, §IV.2)
 * bar putting Spotify Content into an AI model, and these songs are what the models rank. The Spotify fields stay null
 * here; `spotifyDisplay` fills them for display only, after the model has chosen, matched by artist and title.
 */
export type CatalogueSong = { title: string; artist: string; spotifyTrackId: string | null; year: number | null; durationMs: number | null; image: string | null; url: string | null; popularity: number | null };

export type Catalogue = { source: "spotify" | "lastfm"; tracks: CatalogueSong[] };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * An artist's songs from Last.fm (top tracks, most listened first), never from Spotify: this list feeds the learn run's
 * `top_tracks`, the Repertoire research's ranking call and the busk's suggested fill, which a model reads
 * (docs/plan-inputs-architecture.md §3.1 step 4). Last.fm down or without the artist: no songs.
 */
export async function catalogueOf(artist: string, _market: string, adapters: AdapterContext): Promise<Catalogue> {
  const lastfm = await getSongs([artist], adapters);
  const list = lastfm.mode === "fallback" ? [] : (Object.values(lastfm.data)[0] ?? []);
  return {
    source: "lastfm",
    tracks: list.map((t) => ({ title: t.title, artist: t.artist || artist, spotifyTrackId: null, year: null, durationMs: null, image: null, url: t.url, popularity: t.listeners ?? t.playcount ?? null })),
  };
}

/** What Spotify adds to a song for display: its id and link (the play link), cover, length and release year. Never shown to a model. */
export type SpotifyDisplay = { spotifyTrackId: string; url: string; image: string | null; year: number | null; durationMs: number | null };

/** The key a song is matched on: artist and title, remasters and featured credits ignored (lib/text.ts). */
export const displayKey = (artist: string, title: string) => `${nameKey(artist)}|${songKey(title)}`;

/** Most single-song Spotify searches per call, for songs the artist's track list didn't have. */
export const MAX_DISPLAY_SEARCHES = 8;

/**
 * Spotify's display data for songs a model has already chosen (or the server picked), joined server-side by artist and
 * title: the artist's Spotify tracks first (one cached search per artist), then one scoped search per song still
 * unmatched. Songs Spotify doesn't have, or a Spotify outage, simply have no entry: they keep their Last.fm link.
 */
export async function spotifyDisplay(songs: readonly { title: string; artist: string }[], market: string, adapters: AdapterContext): Promise<Map<string, SpotifyDisplay>> {
  const out = new Map<string, SpotifyDisplay>();
  const wanted = new Map<string, { title: string; artist: string }>();
  for (const s of songs) wanted.set(displayKey(s.artist, s.title), s);
  if (wanted.size === 0) return out;
  const take = (key: string, t: { id: string; url: string | null; image: string | null; year: number | null; durationMs: number | null }) => {
    if (out.has(key) || !SPOTIFY_ID.test(t.id)) return;
    out.set(key, { spotifyTrackId: t.id, url: t.url ?? `https://open.spotify.com/track/${t.id}`, image: t.image, year: t.year, durationMs: t.durationMs });
  };
  const byArtist = new Map<string, string>();
  for (const s of wanted.values()) if (!byArtist.has(nameKey(s.artist))) byArtist.set(nameKey(s.artist), s.artist);
  for (const artist of byArtist.values()) {
    const found = await findArtistTracks(artist, market, adapters);
    if (found.mode === "fallback") continue;
    for (const t of found.data) {
      const key = displayKey(artist, t.title);
      if (wanted.has(key) && t.artists.some((a) => nameKey(a.name) === nameKey(artist))) take(key, t);
    }
  }
  const missing = [...wanted.entries()].filter(([key]) => !out.has(key)).slice(0, MAX_DISPLAY_SEARCHES);
  for (const [key, s] of missing) {
    const found = await findArtistTrack(s.title, s.artist, market, adapters);
    if (found.mode === "fallback") continue;
    const hit = found.data.find((t) => songKey(t.title) === songKey(s.title) && t.artists.some((a) => nameKey(a.name) === nameKey(s.artist)));
    if (hit) take(key, hit);
  }
  return out;
}
