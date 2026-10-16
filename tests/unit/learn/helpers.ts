import { playlistSongKey } from "@/lib/playlist-schema";
import type { HistoryData } from "@/server/learn/types";
import type { PlaylistRecord } from "@/server/playlist/store";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * A learn run's inputs without a database: a Repertoire record and its history, run against the Qloo mock, the synthetic
 * Spotify and Last.fm fixtures and the mock learner. The data cache is emulated where it sits in the app (every cached
 * client body is memoised by name and arguments, as 'use cache: remote' does), so Qloo request counts are real.
 */
export const cache = new Map<string, Promise<unknown>>();

/** The body of the `lookupScope` mock: memoise a cached client body by name and arguments, as 'use cache: remote' does. */
export function cachedLookupScope(original: { lookupScope: <T>(name: string, args: readonly unknown[], body: () => Promise<T>) => Promise<T> }) {
  return <T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> => {
    const key = JSON.stringify([name, args]);
    if (!cache.has(key)) cache.set(key, original.lookupScope(name, args, body).catch((e) => (cache.delete(key), Promise.reject(e))));
    return cache.get(key) as Promise<T>;
  };
}

export const pitch = { name: "Bourke Street Mall", lat: -37.8136, lon: 144.9653 };

export function playlist(over: Partial<PlaylistRecord> = {}): PlaylistRecord {
  return { id: "pl-1", actName: "Test Act", soundsLike: [{ name: "Paul Kelly" }], usualPitches: [pitch], recentBusks: [], city: "melbourne", revision: 1, createdAt: 0, lastSeenAt: 0, ...over };
}

export const sung = (title: string, artist: string, state: "can_sing" | "learned" = "can_sing") => ({ title, artist, key: playlistSongKey(artist, title), state });
export const SONGS = [sung("Dumb Things", "Paul Kelly"), sung("To Her Door", "Paul Kelly"), sung("Avant Gardener", "Courtney Barnett"), sung("Scar", "Missy Higgins"), sung("Riptide", "Vance Joy")];

export function history(over: Partial<HistoryData> = {}): HistoryData {
  return { songs: SONGS, suggestions: [], dismissedKeys: [], earlierRuns: 0, lastRun: null, ...over };
}

export async function setupFetch() {
  mockFetch([]);
  return OFFLINE;
}
