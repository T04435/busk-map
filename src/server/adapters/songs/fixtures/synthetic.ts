// SYNTHETIC FIXTURE: invented songs and play counts for tests and offline mode. Not Last.fm data.
import { OFFLINE_TEST_ACTS } from "@/lib/repertoire-research";
import type { SimilarArtist, TopTrack } from "../schema";

export function syntheticTopTracks(artist: string): TopTrack[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    title: `${artist} synthetic song ${n}`,
    artist,
    playcount: Math.round(500_000 / n),
    listeners: Math.round(60_000 / n),
    url: null,
  }));
}

/** Invented listener counts, stable per name. */
export function syntheticListeners(artist: string): number {
  let hash = 0;
  for (const ch of artist) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 10_000 + (hash % 900_000);
}

/**
 * Invented "similar artists", deterministic: the offline test acts get a fixed list (names the Qloo mock knows, names it doesn't,
 * or none), any other name gets none. Not Last.fm data.
 */
export function syntheticSimilar(artist: string): SimilarArtist[] {
  const key = artist.trim().toLowerCase();
  const act = Object.values(OFFLINE_TEST_ACTS).find((t) => t.name.toLowerCase() === key);
  const names: readonly string[] = act && "similar" in act ? act.similar : [];
  return names.map((name, i) => ({ name, match: Math.round((1 - i * 0.1) * 100) / 100 }));
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
  info: { artist: { name: "Synthetic Artist", stats: { listeners: "123456", playcount: "999" } } },
  infoNumeric: { artist: { name: "Synthetic Two", stats: { listeners: 42 } } },
  infoBad: { artist: { name: "Synthetic Bad", stats: {} } },
  similar: { similarartists: { artist: [{ name: "Alike One", match: "1" }, { name: "Alike Two", match: 0.5 }, { name: "", match: "0.1" }] } },
  similarSingle: { similarartists: { artist: { name: "Alike Solo", match: "0.4" } } },
  similarEmpty: { similarartists: { artist: [] } },
  notFound: { error: 6, message: "The artist you supplied could not be found" },
  badKey: { error: 10, message: "Invalid API key" },
};
