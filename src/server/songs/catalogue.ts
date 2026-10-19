import "server-only";
import { nameKey } from "@/lib/text";
import type { AdapterContext } from "@/server/adapters/core";
import { findArtistTracks } from "@/server/adapters/repertoire";
import { getSongs } from "@/server/adapters/songs";

/** One song of an artist's catalogue, from Spotify or (backup) Last.fm. */
export type CatalogueSong = { title: string; artist: string; spotifyTrackId: string | null; year: number | null; durationMs: number | null; image: string | null; url: string | null; popularity: number | null };

export type Catalogue = { source: "spotify" | "lastfm"; tracks: CatalogueSong[] };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * An artist's songs: Spotify first, Last.fm for an artist Spotify has nothing for (or when Spotify is down).
 * Shared by the learn run's `top_tracks` and the busk's suggested fill (docs/plan-inputs-architecture.md §3.1 step 4).
 */
export async function catalogueOf(artist: string, market: string, adapters: AdapterContext): Promise<Catalogue> {
  const spotify = await findArtistTracks(artist, market, adapters);
  const tracks = spotify.mode === "fallback" ? [] : spotify.data;
  if (tracks.length > 0) {
    return {
      source: "spotify",
      tracks: tracks.map((t) => ({
        title: t.title,
        artist: t.artists.find((a) => nameKey(a.name) === nameKey(artist))?.name ?? t.artists[0]?.name ?? artist,
        spotifyTrackId: SPOTIFY_ID.test(t.id) ? t.id : null,
        year: t.year,
        durationMs: t.durationMs,
        image: t.image,
        url: t.url ?? (SPOTIFY_ID.test(t.id) ? `https://open.spotify.com/track/${t.id}` : null),
        popularity: null,
      })),
    };
  }
  const lastfm = await getSongs([artist], adapters);
  const list = lastfm.mode === "fallback" ? [] : (Object.values(lastfm.data)[0] ?? []);
  return {
    source: "lastfm",
    tracks: list.map((t) => ({ title: t.title, artist: t.artist || artist, spotifyTrackId: null, year: null, durationMs: null, image: null, url: t.url, popularity: t.listeners ?? t.playcount ?? null })),
  };
}
