import { nameKey } from "./text";

/** A Spotify artist search row as the picker ranks it: its id, its name and its release count once known. */
export type RankableArtist = { id: string; name: string; releases: number | null };

/**
 * The artist picker's Spotify rows, ranked. Spotify lists empty same-name profiles (0 releases) beside the real artist, and Last.fm's
 * listener count is looked up by name, so every namesake showed the real artist's listeners. Here:
 * - a name with a profile that has releases drops its 0-release namesakes;
 * - same-name rows sit together where the name first appears, the one with the most releases first;
 * - `listeners` is true on one row per name only: the clear match (the most releases; the only row when the name is unique). While
 *   the release counts load, a name shared by several rows shows no listeners.
 * `releases` maps ids to counts loaded after the search; a row's own `releases` counts too.
 */
export function rankArtistResults<A extends RankableArtist>(results: readonly A[], releases: Readonly<Record<string, number>> = {}): { artist: A; released: number | null; listeners: boolean }[] {
  const releasedOf = (a: A): number | null => releases[a.id] ?? a.releases ?? null;
  const groups = new Map<string, A[]>();
  for (const a of results) {
    const key = nameKey(a.name) || a.id;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const out: { artist: A; released: number | null; listeners: boolean }[] = [];
  for (const group of groups.values()) {
    const withReleases = group.some((a) => (releasedOf(a) ?? 0) > 0);
    const kept = withReleases ? group.filter((a) => releasedOf(a) !== 0) : group;
    const ranked = kept.map((a, i) => ({ a, i, n: releasedOf(a) })).sort((x, y) => (y.n ?? -1) - (x.n ?? -1) || x.i - y.i);
    const known = ranked.every((r) => r.n !== null);
    ranked.forEach((r, k) => out.push({ artist: r.a, released: r.n, listeners: ranked.length === 1 || (known && k === 0 && (r.n ?? 0) > (ranked[1]?.n ?? 0)) }));
  }
  return out;
}
