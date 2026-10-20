import "server-only";
import { nameKey } from "@/lib/text";
import type { SoundsLikeSuggestions, SoundsLikeStatus, SpotifyProfile } from "@/lib/playlist-schema";
import { settleWithLimit, type AdapterContext } from "@/server/adapters/core";
import { decideMatch, genreOverlap, MAX_EXTRA_SEARCHES, nameVariants, type MatchCandidate, type MatchDecision, type QlooCandidateView } from "@/lib/qloo-match";
import { resolveSpotifyArtists, searchArtistHits, searchGenreTags, tasteArtists, type QlooEntity } from "@/server/adapters/qloo";
import { getSimilarArtists } from "@/server/adapters/songs";
import { getArtistProfile } from "@/server/adapters/repertoire";
import type { PlaylistRecord } from "./store";

/** Suggestions shown under "Artists you sound like". */
export const SOUNDS_LIKE_TAKE = 10;

/** The performer's own artist, as the plan engine and the suggestions need it. Null until the profile is loaded and Qloo knows it. */
export type OwnArtist = { qlooId: string; spotifyId: string; name: string };

export function ownArtistOf(playlist: Pick<PlaylistRecord, "spotifyArtistId" | "spotifyProfile" | "qlooArtistId">): OwnArtist | null {
  if (!playlist.spotifyArtistId || !playlist.qlooArtistId) return null;
  return { qlooId: playlist.qlooArtistId, spotifyId: playlist.spotifyArtistId, name: playlist.spotifyProfile?.name ?? "" };
}

export type ProfileRefresh = {
  /** Spotify: the snapshot to save, or null when Spotify did not answer (the saved snapshot stays). */
  profile: SpotifyProfile | null;
  /** The artist's Qloo entity, or null when Qloo does not know it (or did not answer). */
  qlooArtistId: string | null;
  /** "matched" | "unknown" (Qloo has no such artist) | "unavailable" (Qloo did not answer). */
  qloo: "matched" | "unknown" | "unavailable";
  spotify: "ok" | "unavailable" | "not_found";
};

/**
 * Loads the Spotify artist and finds the same artist in Qloo (findOwnOnQloo: the external-id lookup first, then name
 * searches the confidence rule accepts; an uncertain match is left unknown here, research asks the user).
 * Called when the link changes or on an explicit refresh, never on page load.
 */
export async function refreshOwnArtist(spotifyId: string, context: AdapterContext): Promise<ProfileRefresh> {
  const spotify = await getArtistProfile(spotifyId, context);
  if (!spotify.data) return { profile: null, qlooArtistId: null, qloo: "unavailable", spotify: spotify.reason === "not_found" ? "not_found" : "unavailable" };
  const profile = spotify.data;
  const found = await findOwnOnQloo(spotifyId, profile.name, context, { genres: profile.genres });
  return { profile, qlooArtistId: found.entity?.id ?? null, qloo: found.qloo, spotify: "ok" };
}

export type OwnOnQloo = {
  entity: QlooEntity | null;
  qloo: ProfileRefresh["qloo"];
  /** How it was found: "id" (Qloo's Spotify-id lookup: certain), "name" (a name search the confidence rule accepted), or null. */
  by: "id" | "name" | null;
  /** Qloo answered but nothing was certain: up to three plausible artists for the user to confirm (empty when nothing came close). */
  candidates: QlooCandidateView[];
  /** The /search calls made (never more than 1 + MAX_EXTRA_SEARCHES). */
  searches: number;
};

const toMatchCandidate = (e: QlooEntity): MatchCandidate => ({ id: e.id, name: e.name, popularity: e.popularity, genres: e.tags.map((t) => t.name), image: e.image ?? null });
export const candidateView = (c: MatchCandidate): QlooCandidateView => ({
  qlooId: c.id,
  name: c.name,
  ...(c.image && /^https:\/\//.test(c.image) && c.image.length <= 500 ? { image: c.image } : {}),
  genres: [...new Set(c.genres.map((g) => g.trim()).filter(Boolean))].slice(0, 2),
});

/**
 * The act's own artist on Qloo, from its Spotify id and name. Shared by the profile refresh and Repertoire research step 3.
 * 1. The external-id lookup: a certain match (it can't pick a namesake).
 * 2. Name searches with variants (accents, "feat." and brackets, "The" on and off, short and long forms), at most 1 + 4 of them,
 *    stopping at the first one the confidence rule (lib/qloo-match.ts) accepts. Both calls are the cached /search and /entities.
 * 3. Otherwise the plausible artists come back as `candidates` for the user to confirm; nothing is ever silently guessed.
 */
export async function findOwnOnQloo(spotifyId: string, name: string, context: AdapterContext, options: { actName?: string | null; genres?: readonly string[] } = {}): Promise<OwnOnQloo> {
  const byId = await resolveSpotifyArtists([spotifyId], context);
  const viaId = byId.data[0] ?? null;
  if (viaId) return { entity: viaId, qloo: "matched", by: "id", candidates: [], searches: 0 };
  if (byId.mode === "fallback") return { entity: null, qloo: "unavailable", by: null, candidates: [], searches: 0 };

  const variants = nameVariants([name, options.actName]);
  const plan = variants.slice(0, 1 + MAX_EXTRA_SEARCHES);
  const genres = options.genres ?? [];
  const pool = new Map<string, QlooEntity>();
  let searches = 0;
  let decision: MatchDecision = { kind: "none" };
  for (const v of plan) {
    const res = await searchArtistHits(v.text, context);
    searches++;
    if (res.mode === "fallback") {
      // Qloo stopped answering: weigh what the earlier searches found, or report an outage when there is none.
      if (pool.size === 0) return { entity: null, qloo: "unavailable", by: null, candidates: [], searches };
      break;
    }
    for (const e of res.data) if (!pool.has(e.id)) pool.set(e.id, e);
    decision = decideMatch([...pool.values()].map(toMatchCandidate), variants, genres);
    if (decision.kind === "match") break;
  }
  if (decision.kind === "match") return { entity: pool.get(decision.best.id) ?? null, qloo: "matched", by: "name", candidates: [], searches };
  return { entity: null, qloo: "unknown", by: null, candidates: decision.kind === "ask" ? decision.candidates.map(candidateView) : [], searches };
}

/**
 * Artists whose fans overlap this performer's: Qloo insights (`filter.type=urn:entity:artist`) signalled with the
 * performer's own entity. Cached for days by the Qloo client; the own artist is left out.
 */
export async function soundsLikeFor(playlist: PlaylistRecord, context: AdapterContext): Promise<SoundsLikeSuggestions> {
  const none = (status: SoundsLikeStatus): SoundsLikeSuggestions => ({ status, artists: [] });
  if (!playlist.spotifyArtistId) return none("no_artist");
  if (!playlist.qlooArtistId) return none(playlist.spotifyProfile ? "unknown_artist" : "not_loaded");
  const result = await tasteArtists([playlist.qlooArtistId], SOUNDS_LIKE_TAKE + 2, context);
  if (result.mode === "fallback") return none("unavailable");
  const own = playlist.spotifyProfile ? nameKey(playlist.spotifyProfile.name) : null;
  const artists = result.data.artists
    .filter((a) => a.id !== playlist.qlooArtistId && nameKey(a.name) !== own)
    .slice(0, SOUNDS_LIKE_TAKE)
    .map((a) => ({
      name: a.name,
      qlooId: a.id,
      // Qloo's external ids carry the Spotify artist when it has one; otherwise none (the chip says "Qloo", never "typed").
      ...(a.spotifyId && /^[A-Za-z0-9]{22}$/.test(a.spotifyId) ? { spotifyId: a.spotifyId } : {}),
      ...(a.image && /^https:\/\//.test(a.image) ? { image: a.image } : {}),
      ...(a.tags.length > 0 ? { tags: a.tags.slice(0, 3).map((t) => t.name) } : {}),
    }));
  return { status: "ok", artists };
}

/** Last.fm names tried for the act (the Spotify name, then the act name and the other variants qloo-match makes). Each is one cached request. */
export const SIMILAR_NAME_TRIES = 3;
/** Similar artists looked up on Qloo (one cached /search each), best match first. */
export const SIMILAR_LOOKUPS = 8;
/** Sound-alikes the Hive keeps. */
export const FOUND_ALIKES_KEPT = 5;
/** Genre tags kept as the signal when no sound-alike resolves. */
export const GENRE_TAGS_KEPT = 3;

export type FoundAlike = { name: string; qlooId: string; spotifyId?: string; image?: string };
export type FoundSoundAlikes =
  | { source: "lastfm"; alikes: FoundAlike[]; tags: []; similar: string[] }
  | { source: "genres"; alikes: []; tags: { id: string; name: string }[]; similar: string[] }
  | { source: "none"; alikes: []; tags: []; similar: string[] }
  | { source: "unavailable"; alikes: []; tags: []; similar: string[] };

/**
 * An act Qloo doesn't know and the performer has no "Artists you sound like": the Hive finds some itself.
 * 1. Last.fm artist.getSimilar for the act, trying the name variants qloo-match makes until one gives artists.
 * 2. Each similar artist is looked up on Qloo with the same confidence rule as the act itself (decideMatch: only a certain
 *    match counts; a guess never does); the first FOUND_ALIKES_KEPT that resolve are the signal.
 * 3. None resolve: the act's Spotify genres as Qloo genre tags (/v2/tags). Nothing there either: source "none".
 * "unavailable" means Qloo stopped answering (the caller treats it as an outage). Last.fm being down only skips step 1.
 */
export async function findSoundAlikes(act: { name: string; actName?: string | null; genres: readonly string[] }, context: AdapterContext): Promise<FoundSoundAlikes> {
  const own = new Set([nameKey(act.name), nameKey(act.actName ?? "")].filter(Boolean));
  let similar: string[] = [];
  for (const v of nameVariants([act.name, act.actName]).slice(0, SIMILAR_NAME_TRIES)) {
    const res = await getSimilarArtists(v.text, context);
    if (res.mode === "fallback") break;
    similar = [...new Set(res.data.filter((a) => !own.has(nameKey(a.name))).map((a) => a.name))];
    if (similar.length > 0) break;
  }

  let outages = 0;
  const tried = similar.slice(0, SIMILAR_LOOKUPS);
  const settled = await settleWithLimit(tried, 3, async (name): Promise<FoundAlike | null> => {
    const res = await searchArtistHits(name, context);
    if (res.mode === "fallback") {
      outages++;
      return null;
    }
    const decision = decideMatch(res.data.map(toMatchCandidate), nameVariants([name]), []);
    if (decision.kind !== "match") return null;
    const e = res.data.find((x) => x.id === decision.best.id);
    if (!e || own.has(nameKey(e.name))) return null;
    return { name: e.name, qlooId: e.id, ...(e.spotifyId && /^[A-Za-z0-9]{22}$/.test(e.spotifyId) ? { spotifyId: e.spotifyId } : {}), ...(e.image && /^https:\/\//.test(e.image) && e.image.length <= 500 ? { image: e.image } : {}) };
  });
  const seen = new Set<string>();
  const alikes = settled
    .flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []))
    .filter((a) => !seen.has(a.qlooId) && seen.add(a.qlooId))
    .slice(0, FOUND_ALIKES_KEPT);
  if (alikes.length > 0) return { source: "lastfm", alikes, tags: [], similar };
  if (tried.length > 0 && outages === tried.length) return { source: "unavailable", alikes: [], tags: [], similar };

  const tags = new Map<string, string>();
  let tagOutage = false;
  for (const genre of act.genres.slice(0, 4)) {
    if (tags.size >= GENRE_TAGS_KEPT) break;
    const res = await searchGenreTags(genre, 5, context);
    if (res.mode === "fallback") {
      tagOutage = true;
      break;
    }
    const hit = res.data.find((t) => t.id.startsWith("urn:tag:genre") && genreOverlap([t.name], [genre]));
    if (hit && !tags.has(hit.id)) tags.set(hit.id, hit.name);
  }
  if (tags.size > 0) return { source: "genres", alikes: [], tags: [...tags].map(([id, name]) => ({ id, name })), similar };
  return tagOutage && act.genres.length > 0 ? { source: "unavailable", alikes: [], tags: [], similar } : { source: "none", alikes: [], tags: [], similar };
}
