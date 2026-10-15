import { nameKey } from "@/lib/text";

/** An artist the act sounds like (a "sounds like" chip): Spotify id when picked from search, else just the typed name. */
export type ActArtist = { name: string; spotifyId: string | null };

type RankedTrack = { id: string; artists: readonly { id: string; name: string }[] };

/** How many chip artists get their own scoped Spotify query per song search. */
export const MAX_SCOPED_ARTISTS = 3;

/** True when one of the track's artists is one of the act's artists: by Spotify id, else by normalised name. */
export function isByActArtist(track: RankedTrack, artists: readonly ActArtist[]): boolean {
  if (artists.length === 0) return false;
  const ids = new Set(artists.flatMap((a) => (a.spotifyId ? [a.spotifyId] : [])));
  const names = new Set(artists.map((a) => nameKey(a.name)).filter(Boolean));
  return track.artists.some((a) => ids.has(a.id) || names.has(nameKey(a.name)));
}

/**
 * Tracks by the act's artists first, then the rest. Spotify's order is kept
 * within each group (a stable partition, never a re-sort by anything else).
 */
export function rankByActArtists<T extends RankedTrack>(tracks: readonly T[], artists: readonly ActArtist[]): T[] {
  const mine: T[] = [];
  const rest: T[] = [];
  for (const track of tracks) (isByActArtist(track, artists) ? mine : rest).push(track);
  return [...mine, ...rest];
}

/** Concatenate result lists in order, keeping the first copy of each track id. */
export function mergeTrackLists<T extends { id: string }>(...lists: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const list of lists) {
    for (const track of list) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      merged.push(track);
    }
  }
  return merged;
}

/** The chip artists worth a scoped query: distinct names, first ones first, capped. */
export function scopedArtistNames(artists: readonly ActArtist[], max = MAX_SCOPED_ARTISTS): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const a of artists) {
    const key = nameKey(a.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(a.name.trim());
    if (names.length === max) break;
  }
  return names;
}
