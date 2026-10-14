// SYNTHETIC FIXTURE: invented songs and play counts for tests and offline mode. Not Last.fm data.
import type { TopTrack } from "../schema";

export function syntheticTopTracks(artist: string): TopTrack[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    title: `${artist} synthetic song ${n}`,
    artist,
    playcount: Math.round(500_000 / n),
    listeners: Math.round(60_000 / n),
    url: null,
  }));
}

export const SYNTHETIC_RAW = {
  ok: {
    toptracks: {
      track: [
        { name: "Synthetic Song One", playcount: "1000", listeners: "300", url: "https://example.com/1", artist: { name: "Synthetic Artist" } },
        { name: "Synthetic Song Two", playcount: 500, listeners: 100, artist: { name: "Synthetic Artist" } },
        { name: "", playcount: "1", listeners: "1", artist: { name: "Synthetic Artist" } },
      ],
      "@attr": { artist: "Synthetic Artist" },
    },
  },
  single: {
    toptracks: { track: { name: "Only Song", playcount: "5", listeners: "2", artist: { name: "Synthetic Solo" } } },
  },
  notFound: { error: 6, message: "The artist you supplied could not be found" },
  badKey: { error: 10, message: "Invalid API key" },
};
