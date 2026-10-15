import { nameKey, trackKey } from "@/lib/text";

/**
 * Setlist ordering for one pitch. Only songs the performer picked are used.
 * Qloo has no song-level data, so a song's local appeal is its artist's
 * affinity with the crowd at that pitch, blended with the song's own
 * popularity (Last.fm play counts) when known.
 */
export type RepertoireSong = {
  id: string;
  title: string;
  artist: string;
  /** Qloo entity id of the song's artist, when resolved. */
  artistEntityId: string | null;
  /** The performer's own song. */
  own: boolean;
  /** Track length, when known. */
  durationMs: number | null;
};

export type SetlistEntry = {
  songId: string;
  title: string;
  artist: string;
  own: boolean;
  /** 0–100. */
  score: number;
  /** Local affinity (0–1) of the artist, relative to the performer's best. */
  affinity: number;
  /**
   * "qloo": from Qloo for this artist at this pitch; "proxy": the performer's typical affinity
   * (own songs, artists Qloo couldn't match, and matched artists Qloo has no local score for).
   */
  affinitySource: "qloo" | "proxy";
  playcount: number | null;
  reason: string;
  durationMs: number | null;
};

export const AFFINITY_WEIGHT = 0.6;
export const POPULARITY_WEIGHT = 0.4;
export const DEFAULT_MAX_SONGS = 12;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const formatPlays = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

/**
 * Score and order the repertoire for a pitch.
 * - Opener: the most recognisable song among the three best, to draw a crowd.
 * - Then best-first, avoiding the same artist twice in a row where possible.
 */
export function buildSetlist(
  songs: RepertoireSong[],
  affinityByEntity: Record<string, number>,
  playcounts: Record<string, number>,
  maxSongs = DEFAULT_MAX_SONGS,
): SetlistEntry[] {
  const unique = new Map<string, RepertoireSong>();
  for (const song of songs) {
    const key = trackKey(song.artist, song.title);
    if (!unique.has(key)) unique.set(key, song);
  }
  const list = [...unique.values()];
  if (list.length === 0) return [];

  const known = list
    .map((s) => (s.artistEntityId ? affinityByEntity[s.artistEntityId] : undefined))
    .filter((v): v is number => v !== undefined);
  const proxy = known.length > 0 ? median(known) : 0.5;
  const maxAffinity = Math.max(proxy, ...known);
  const plays = list.map((s) => playcounts[trackKey(s.artist, s.title)] ?? null);
  const maxPlays = Math.max(0, ...plays.map((p) => p ?? 0));

  const scored: SetlistEntry[] = list.map((song, i) => {
    const raw = song.artistEntityId ? affinityByEntity[song.artistEntityId] : undefined;
    const source: SetlistEntry["affinitySource"] = raw === undefined ? "proxy" : "qloo";
    const affinity = maxAffinity > 0 ? (raw ?? proxy) / maxAffinity : 0;
    const playcount = plays[i];
    const popularity = playcount !== null && maxPlays > 0 ? Math.log1p(playcount) / Math.log1p(maxPlays) : null;
    const score = popularity === null ? affinity : AFFINITY_WEIGHT * affinity + POPULARITY_WEIGHT * popularity;
    const why = [
      source === "qloo"
        ? `Crowd affinity for ${song.artist}: ${Math.round(affinity * 100)}/100`
        : song.own
          ? "Your own song: scored with your typical crowd affinity"
          : song.artistEntityId
            ? // Qloo matched the artist but left them out of this pitch's local scores (live Qloo does this for some artists).
              `Qloo has no local score for ${song.artist} at this pitch: scored with your typical crowd affinity`
            : `No Qloo match for ${song.artist}: scored with your typical crowd affinity`,
    ];
    if (playcount !== null) why.push(`${formatPlays(playcount)} Last.fm plays`);
    return {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      own: song.own,
      score: Math.round(score * 100),
      affinity: Math.round(affinity * 1000) / 1000,
      affinitySource: source,
      playcount,
      reason: why.join("; "),
      durationMs: song.durationMs,
    };
  });

  const ranked = scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const head = ranked.slice(0, 3);
  const playsOf = (entry: SetlistEntry) => entry.playcount ?? -1;
  const opener = head.reduce((best, s) => (playsOf(s) > playsOf(best) ? s : best), head[0]);
  const order: SetlistEntry[] = [opener];
  const rest = ranked.filter((s) => s !== opener);
  while (rest.length > 0 && order.length < maxSongs) {
    const previous = nameKey(order[order.length - 1].artist);
    const index = rest.findIndex((s) => nameKey(s.artist) !== previous);
    order.push(rest.splice(index === -1 ? 0 : index, 1)[0]);
  }
  return order;
}

export type RisingArtist = {
  entityId: string;
  name: string;
  /** Local affinity with the crowd (0–1), when known. */
  affinity: number | null;
  /** Change in Qloo population percentile over the window. */
  percentDelta: number | null;
  /** Last.fm listeners (from Qloo's entity data), when known. */
  listeners?: number | null;
};

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export type LearnSuggestion = {
  artist: string;
  entityId: string;
  /** A top song to learn, or null when Last.fm has none. */
  title: string | null;
  playcount: number | null;
  percentDelta: number | null;
  affinity: number | null;
  reason: string;
};

/**
 * "Learn these": songs by artists rising with this crowd that the performer
 * doesn't already play. Rising first, then local affinity, then Last.fm
 * listeners (the fallback order when Qloo has no trending data).
 */
export function learnThese(
  artists: RisingArtist[],
  topTracks: Record<string, { title: string; playcount: number }[]>,
  repertoire: RepertoireSong[],
  count = 3,
): LearnSuggestion[] {
  const playedArtists = new Set(repertoire.map((s) => nameKey(s.artist)));
  const delta = (a: RisingArtist) => a.percentDelta ?? Number.NEGATIVE_INFINITY;
  const affinity = (a: RisingArtist) => a.affinity ?? 0;
  const listeners = (a: RisingArtist) => a.listeners ?? 0;
  const ranked = artists
    .filter((a) => !playedArtists.has(nameKey(a.name)))
    .sort((a, b) => delta(b) - delta(a) || affinity(b) - affinity(a) || listeners(b) - listeners(a) || a.name.localeCompare(b.name));
  return ranked.slice(0, count).map((artist) => {
    // The artist isn't in the repertoire, so their top song is new to the performer.
    const track = topTracks[artist.name]?.[0] ?? null;
    const why: string[] = [];
    if (artist.percentDelta !== null) why.push(`${artist.percentDelta > 0 ? "Rising" : "Steady"} with this crowd (${artist.percentDelta > 0 ? "+" : ""}${artist.percentDelta.toFixed(1)} pts)`);
    if (artist.affinity !== null) why.push(`affinity ${Math.round(artist.affinity * 100)}/100`);
    if (artist.listeners) why.push(`${formatListeners(artist.listeners)} Last.fm listeners`);
    return {
      artist: artist.name,
      entityId: artist.entityId,
      title: track?.title ?? null,
      playcount: track?.playcount ?? null,
      percentDelta: artist.percentDelta,
      affinity: artist.affinity,
      reason: why.length > 0 ? why.join(", ") : "Liked by this crowd",
    };
  });
}

