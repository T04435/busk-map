import { nameKey, trackKey } from "@/lib/text";
import type { RepertoireSong } from "./setlist";

/**
 * Suggested fill (docs/plan-inputs-architecture.md §3.1): songs Busk Map adds to a busk's set when the act asked for
 * them (`performer.fillSuggested`). Pure and deterministic: the candidates, the per-pitch affinity and the catalogue
 * come in as data, nothing here calls out.
 */

/** An artist that could supply suggested songs: the city crowd's, or related to the act's. */
export type FillArtist = {
  id: string;
  name: string;
  /** Qloo audience growth with the crowd, when sent. */
  growth: number | null;
  /** Last.fm listeners, when Qloo carried them. */
  listeners: number | null;
  /** Names of the act's artists that explain the match (Qloo explainability), strongest first. */
  because: string[];
  /** Set on artists from the local scene (Qloo compare + genre tag): `fit` is the act's fans' affinity for them, when known. */
  local?: { fit: number | null };
};

/** One catalogue song, as Spotify or Last.fm gave it. */
export type FillTrack = {
  title: string;
  artist: string;
  spotifyTrackId: string | null;
  year: number | null;
  durationMs: number | null;
  url: string | null;
  popularity: number | null;
};

/** Merge the city crowd's artists and the related artists (first listing wins, explanations join), leaving out artists already in the set. */
export function mergeFillArtists(lists: FillArtist[][], leaveOut: Set<string>, leaveOutIds: Set<string> = new Set()): FillArtist[] {
  const out = new Map<string, FillArtist>();
  for (const a of lists.flat()) {
    if (leaveOutIds.has(a.id) || leaveOut.has(nameKey(a.name))) continue;
    const have = out.get(a.id);
    if (!have) out.set(a.id, { ...a, because: [...a.because] });
    else {
      for (const b of a.because) if (!have.because.includes(b)) have.because.push(b);
      have.growth ??= a.growth;
      have.listeners ??= a.listeners;
      have.local ??= a.local;
    }
  }
  return [...out.values()];
}

/**
 * Order the candidates for one pitch, the `learnThese` order: the crowd's affinity at the pitch first (call #6), then
 * Qloo audience growth, then Last.fm listeners. Artists the pitch call did not score go after the scored ones.
 */
export function rankFillArtists(artists: FillArtist[], affinityAt: Record<string, number>): FillArtist[] {
  const aff = (a: FillArtist) => affinityAt[a.id] ?? Number.NEGATIVE_INFINITY;
  return [...artists].sort(
    (a, b) => aff(b) - aff(a) || (b.growth ?? 0) - (a.growth ?? 0) || (b.listeners ?? 0) - (a.listeners ?? 0) || a.name.localeCompare(b.name),
  );
}

const formatListeners = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/** "Liked by the crowd here (affinity 82/100), fans also like Paul Kelly": every number comes from the data. */
export function suggestionBecause(artist: FillArtist, affinity: number | undefined): string {
  const bits = [affinity !== undefined ? `Liked by the crowd here (affinity ${Math.round(affinity * 100)}/100)` : "Liked by this city's crowd"];
  if (artist.local) bits.unshift(artist.local.fit !== null ? `A local act your fans would like (${Math.round(artist.local.fit * 100)}/100)` : "A local act");
  if (artist.because.length > 0) bits.push(`fans also like ${artist.because.slice(0, 2).join(" and ")}`);
  if (artist.listeners) bits.push(`${formatListeners(artist.listeners)} Last.fm listeners`);
  return bits.join(", ");
}

export type FillPick = { artist: FillArtist; track: FillTrack; source: "spotify" | "lastfm" };

/**
 * Take up to `count` songs from the ranked artists, at most `perArtist` each, never one the act already has
 * (`have`, keyed by trackKey) or removed for this busk (`skip`). `catalogue` is read lazily and in rank order, so the
 * lookups stop as soon as the count is met (`maxArtists` bounds them). The same song is never picked twice.
 */
export async function pickFillSongs(
  ranked: FillArtist[],
  count: number,
  perArtist: number,
  maxArtists: number,
  have: Set<string>,
  skip: Set<string>,
  catalogue: (artist: FillArtist) => Promise<{ source: "spotify" | "lastfm"; tracks: FillTrack[] } | null>,
): Promise<FillPick[]> {
  const picks: FillPick[] = [];
  const taken = new Set<string>();
  let looked = 0;
  for (const artist of ranked) {
    if (picks.length >= count || looked >= maxArtists) break;
    looked++;
    const found = await catalogue(artist);
    if (!found) continue;
    let fromArtist = 0;
    for (const track of found.tracks) {
      if (picks.length >= count || fromArtist >= perArtist) break;
      const key = trackKey(track.artist, track.title);
      if (have.has(key) || skip.has(key) || taken.has(key)) continue;
      taken.add(key);
      fromArtist++;
      picks.push({ artist, track, source: found.source });
    }
  }
  return picks;
}

/** The suggested songs as set candidates: `buildSetlist` scores them with the act's own. */
export function fillAsRepertoire(picks: FillPick[], affinityAt: Record<string, number>): RepertoireSong[] {
  return picks.map((p, i) => ({
    id: `suggested-${i}`,
    title: p.track.title,
    artist: p.track.artist,
    artistEntityId: p.artist.id,
    own: false,
    durationMs: p.track.durationMs,
    suggestion: {
      because: suggestionBecause(p.artist, affinityAt[p.artist.id]),
      source: p.source,
      sourceUrl: p.track.url,
      spotifyTrackId: p.track.spotifyTrackId,
    },
  }));
}
