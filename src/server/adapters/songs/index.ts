import "server-only";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchTopTracks } from "./client";
import { syntheticTopTracks } from "./fixtures/synthetic";
import type { SongsData } from "./schema";

export type { SongsData, TopTrack } from "./schema";

export const TOP_TRACKS_PER_ARTIST = 10;
/** Bound the fan-out to keep within Last.fm's fair-use rate. */
export const MAX_ARTISTS = 12;

/**
 * Top tracks for each artist. One artist failing leaves the others intact;
 * if every lookup fails the adapter falls back to "artist only, no song names".
 */
export async function getSongs(artists: string[], context: AdapterContext): Promise<AdapterResult<SongsData>> {
  const names = [...new Set(artists.map((a) => a.trim()).filter(Boolean))].slice(0, MAX_ARTISTS);
  return runAdapter({
    adapter: "songs",
    source: "lastfm",
    context,
    configured: providerStatus().lastfm,
    fallback: {},
    synthetic: () => Object.fromEntries(names.map((name) => [name, syntheticTopTracks(name)])),
    live: async () => {
      const settled = await Promise.allSettled(names.map((name) => fetchTopTracks(name, TOP_TRACKS_PER_ARTIST)));
      const failures = settled.filter((s) => s.status === "rejected");
      if (names.length > 0 && failures.length === names.length) throw (failures[0] as PromiseRejectedResult).reason;
      if (failures.length > 0) log.warn("last.fm lookups failed for some artists", { failed: failures.length, total: names.length });
      return Object.fromEntries(
        settled.flatMap((s, i) => (s.status === "fulfilled" ? [[names[i], s.value]] : [])),
      );
    },
  });
}
