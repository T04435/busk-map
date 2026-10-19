import { nameKey, trackKey } from "@/lib/text";
import { LOCAL_SCENE_BONUS } from "./local-scene";

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
  /** Set on songs Busk Map added (suggested fill, docs/plan-inputs-architecture.md §3.3); absent on the act's own. */
  suggestion?: SongSuggestion;
};

/** Why a suggested song is in the set and where it was found. */
export type SongSuggestion = { because: string; source: "spotify" | "lastfm"; sourceUrl: string | null; spotifyTrackId: string | null; /** The track's image, only when the catalogue had one. */ image?: string };

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
  /** First release year (Spotify), when known. */
  year: number | null;
  /** 0–1: how well the song's era suits the crowd's age lean, when both are known. */
  eraFit: number | null;
  /** "suggested" for songs Busk Map added from the crowd's taste; the act's own are "repertoire". */
  origin: "repertoire" | "suggested";
  suggestion: SongSuggestion | null;
  /** The artist's photo, set after scoring when an entity already fetched has one. */
  artistImage?: string;
  /** The song's artist is in the city's local scene (the act's fans' affinity for it is known): the score includes the local-scene bonus. */
  localScene: boolean;
};

/**
 * Score weights. Missing parts drop out and the rest are rescaled, so without
 * a release year (or an age lean) a song scores 60% affinity, 40% popularity.
 */
export const AFFINITY_WEIGHT = 0.48;
export const POPULARITY_WEIGHT = 0.32;
export const ERA_WEIGHT = 0.2;
export const DEFAULT_MAX_SONGS = 12;

// ---- Era matching -----------------------------------------------------------

/** Midpoint age of each Qloo demographics age band. */
export const AGE_BAND_MIDPOINTS: Record<string, number> = {
  "24_and_younger": 21,
  "25_to_29": 27,
  "30_to_34": 32,
  "35_to_44": 40,
  "45_to_54": 50,
  "55_and_older": 62,
};
/** People stay most attached to the music of their teens and early twenties: songs from about age 17 fit best. */
export const FORMATIVE_AGE = 17;
/** How far either side of that year a song still fits well (one standard deviation, in years). */
export const ERA_SPREAD_YEARS = 10;

/** Qloo demographics: signed lean per age band (positive = over-represented among fans). */
export type AgeLean = Record<string, number>;

/**
 * How well a release year suits a crowd, 0–1: each over-represented age band
 * (positive lean) prefers songs from when it was about FORMATIVE_AGE, with a
 * Gaussian fall-off; bands are weighted by their lean. Null when the crowd has
 * no positive lean or no known band.
 */
export function eraFit(year: number, ageLean: AgeLean, currentYear: number): number | null {
  let weighted = 0;
  let total = 0;
  for (const [band, lean] of Object.entries(ageLean)) {
    const age = AGE_BAND_MIDPOINTS[band];
    if (age === undefined || lean <= 0) continue;
    const peak = currentYear - age + FORMATIVE_AGE;
    weighted += lean * Math.exp(-(((year - peak) / ERA_SPREAD_YEARS) ** 2) / 2);
    total += lean;
  }
  return total === 0 ? null : weighted / total;
}

/**
 * Era fit in words for the setlist reason (the number stays in `eraFit`). Bands of the 0–1 fit:
 * ≥ 0.75 "a strong", ≥ 0.5 "a good", ≥ 0.25 "a fair", below 0.25 "a weak".
 */
export const ERA_FIT_WORDS: readonly (readonly [min: number, words: string])[] = [
  [0.75, "a strong"],
  [0.5, "a good"],
  [0.25, "a fair"],
  [0, "a weak"],
];

export function eraFitWords(fit: number): string {
  return ERA_FIT_WORDS.find(([min]) => fit >= min)?.[1] ?? "a weak";
}

/** The crowd's most over-represented age band, for labels ("25_to_29"), or null. */
export function leadingAgeBand(ageLean: AgeLean | null): string | null {
  const known = Object.entries(ageLean ?? {}).filter(([band, lean]) => AGE_BAND_MIDPOINTS[band] !== undefined && lean > 0);
  return known.length === 0 ? null : known.reduce((best, row) => (row[1] > best[1] ? row : best))[0];
}

/** Release years (keyed by trackKey) and the crowd's age lean, for era matching. */
export type EraInputs = { years: Record<string, number>; ageLean: AgeLean | null; currentYear: number; ageLabel?: (band: string) => string };

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
  era: EraInputs | null = null,
  /**
   * The local scene: entity id to the act's fans' affinity (0–1) for that local act. A song by a scene artist gets up to
   * LOCAL_SCENE_BONUS on its 0–1 score, in proportion to how the act's fans rank that artist within the scene; every
   * other song scores exactly as before.
   */
  scene: Record<string, number> | null = null,
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
  const sceneMax = Math.max(0, ...Object.values(scene ?? {}));

  const scored: SetlistEntry[] = list.map((song, i) => {
    const raw = song.artistEntityId ? affinityByEntity[song.artistEntityId] : undefined;
    const source: SetlistEntry["affinitySource"] = raw === undefined ? "proxy" : "qloo";
    const affinity = maxAffinity > 0 ? (raw ?? proxy) / maxAffinity : 0;
    const playcount = plays[i];
    const popularity = playcount !== null && maxPlays > 0 ? Math.log1p(playcount) / Math.log1p(maxPlays) : null;
    const year = era?.years[trackKey(song.artist, song.title)] ?? null;
    const fit = year !== null && era?.ageLean ? eraFit(year, era.ageLean, era.currentYear) : null;
    const parts: [weight: number, value: number | null][] = [
      [AFFINITY_WEIGHT, affinity],
      [POPULARITY_WEIGHT, popularity],
      [ERA_WEIGHT, fit],
    ];
    const present = parts.filter((p): p is [number, number] => p[1] !== null);
    const base = present.reduce((sum, [w, v]) => sum + w * v, 0) / present.reduce((sum, [w]) => sum + w, 0);
    const sceneRaw = song.artistEntityId && sceneMax > 0 ? scene?.[song.artistEntityId] : undefined;
    const score = sceneRaw === undefined ? base : Math.min(1, base + LOCAL_SCENE_BONUS * (sceneRaw / sceneMax));
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
    if (sceneRaw !== undefined) why.push(`local scene act your fans would like (${Math.round(sceneRaw * 100)}/100)`);
    if (playcount !== null) why.push(`${formatPlays(playcount)} Last.fm plays`);
    if (year !== null && fit !== null) {
      // A fit implies at least one over-represented, known age band.
      const band = leadingAgeBand(era!.ageLean)!;
      why.push(`from ${year}: ${eraFitWords(fit)} era fit for a crowd leaning ${era!.ageLabel?.(band) ?? band}`);
    } else if (year !== null) why.push(`from ${year}`);
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
      year,
      eraFit: fit === null ? null : Math.round(fit * 1000) / 1000,
      origin: song.suggestion ? "suggested" : "repertoire",
      suggestion: song.suggestion ?? null,
      localScene: sceneRaw !== undefined,
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
  /** Qloo's audience_growth measurement for the artist with this crowd, when known. */
  audienceGrowth?: number | null;
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
  audienceGrowth: number | null;
  reason: string;
};

/**
 * "Learn these": songs by artists growing with this crowd that the performer
 * doesn't already play. Qloo's audience growth first, then trending momentum,
 * then local affinity, then Last.fm listeners (the fallback order when Qloo
 * reports no growth and no trending movement).
 */
export function learnThese(
  artists: RisingArtist[],
  topTracks: Record<string, { title: string; playcount: number }[]>,
  repertoire: RepertoireSong[],
  count = 3,
): LearnSuggestion[] {
  const playedArtists = new Set(repertoire.map((s) => nameKey(s.artist)));
  const growth = (a: RisingArtist) => a.audienceGrowth ?? 0;
  const delta = (a: RisingArtist) => a.percentDelta ?? Number.NEGATIVE_INFINITY;
  const affinity = (a: RisingArtist) => a.affinity ?? 0;
  const listeners = (a: RisingArtist) => a.listeners ?? 0;
  const ranked = artists
    .filter((a) => !playedArtists.has(nameKey(a.name)))
    .sort((a, b) => growth(b) - growth(a) || delta(b) - delta(a) || affinity(b) - affinity(a) || listeners(b) - listeners(a) || a.name.localeCompare(b.name));
  return ranked.slice(0, count).map((artist) => {
    // The artist isn't in the repertoire, so their top song is new to the performer.
    const track = topTracks[artist.name]?.[0] ?? null;
    const why: string[] = [];
    if (artist.audienceGrowth) why.push(`Audience ${artist.audienceGrowth > 0 ? "growing" : "shrinking"} with this crowd (Qloo audience growth ${artist.audienceGrowth > 0 ? "+" : ""}${artist.audienceGrowth.toFixed(2)})`);
    if (artist.percentDelta !== null) why.push(`${artist.percentDelta > 0 ? "Rising" : "Steady"} with this crowd (${artist.percentDelta > 0 ? "+" : ""}${artist.percentDelta.toFixed(1)} pts)`);
    if (artist.affinity !== null) why.push(`${artist.affinity >= 0.8 ? "a very strong" : artist.affinity >= 0.6 ? "a strong" : artist.affinity >= 0.4 ? "a fair" : "a weak"} taste match`);
    if (artist.listeners) why.push(`${formatListeners(artist.listeners)} Last.fm listeners`);
    return {
      artist: artist.name,
      entityId: artist.entityId,
      title: track?.title ?? null,
      playcount: track?.playcount ?? null,
      percentDelta: artist.percentDelta,
      affinity: artist.affinity,
      audienceGrowth: artist.audienceGrowth ?? null,
      reason: why.length > 0 ? why.join(", ") : "Liked by this crowd",
    };
  });
}

