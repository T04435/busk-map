import "server-only";
import { nameKey } from "@/lib/text";
import { genreSearchTexts, isMusicGenreTag, isPlaceOrPeopleTag } from "@/lib/genre-tags";
import { log } from "@/server/log";
import type { SoundsLikeSuggestions, SoundsLikeStatus, SpotifyProfile } from "@/lib/playlist-schema";
import { settleWithLimit, type AdapterContext } from "@/server/adapters/core";
import { buttonGenreTag, decideMatch, hasMusicGenre, isCoarseGenre, isGenreTagId, tagSlug, isOtherSpotifyArtist, MAX_EXTRA_SEARCHES, nameVariants, normGenre, pickGenreTag, usableTagNames, type MatchCandidate, type MatchDecision, type QlooCandidateView } from "@/lib/qloo-match";
import { resolveSpotifyArtists, searchArtistHits, searchGenreTags, tasteArtists, type QlooEntity } from "@/server/adapters/qloo";
import { getSimilarArtists, getSongs, getTopTags, getTrackTopTags } from "@/server/adapters/songs";
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
  // A weak match (no music-genre tag) isn't saved as the performer's artist: research weighs it against the Hive's sound-alikes.
  if (found.weak) return { profile, qlooArtistId: null, qloo: "unknown", spotify: "ok" };
  return { profile, qlooArtistId: found.entity?.id ?? null, qloo: found.qloo, spotify: "ok" };
}

export type OwnOnQloo = {
  entity: QlooEntity | null;
  qloo: ProfileRefresh["qloo"];
  /** How it was found: "id" (Qloo's Spotify-id lookup: certain), "name" (a name search the confidence rule accepted), or null. */
  by: "id" | "name" | null;
  /** Qloo answered but nothing was certain: up to three plausible artists for the user to confirm (empty when nothing came close). */
  candidates: QlooCandidateView[];
  /** The entity has no music-genre tag (urn:tag:genre:music…): a name without taste data, so it is not the taste signal alone. */
  weak: boolean;
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
  if (viaId) return { entity: viaId, qloo: "matched", by: "id", candidates: [], weak: !hasMusicGenre(viaId), searches: 0 };
  if (byId.mode === "fallback") return { entity: null, qloo: "unavailable", by: null, candidates: [], weak: false, searches: 0 };

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
      if (pool.size === 0) return { entity: null, qloo: "unavailable", by: null, candidates: [], weak: false, searches };
      break;
    }
    // A name hit carrying another Spotify id is another artist with the same name.
    for (const e of res.data) if (!pool.has(e.id) && !isOtherSpotifyArtist(e.spotifyId, spotifyId)) pool.set(e.id, e);
    decision = decideMatch([...pool.values()].map(toMatchCandidate), variants, genres);
    if (decision.kind === "match") break;
  }
  if (decision.kind === "match") {
    const entity = pool.get(decision.best.id) ?? null;
    return { entity, qloo: "matched", by: "name", candidates: [], weak: entity ? !hasMusicGenre(entity) : false, searches };
  }
  return { entity: null, qloo: "unknown", by: null, candidates: decision.kind === "ask" ? decision.candidates.map(candidateView) : [], weak: false, searches };
}

/** Saved sound-alikes (with a Qloo id) that stand in for an act Qloo doesn't know, at most. */
export const SOUNDS_LIKE_SIGNAL = 3;

/**
 * Artists whose fans overlap this performer's: Qloo insights (`filter.type=urn:entity:artist`) signalled with the
 * performer's own entity. When Qloo doesn't know the act, the saved "Artists you sound like" Qloo knows are the signal
 * instead (unknown_artist only when there are none). Cached for days by the Qloo client; the own artist and the ones
 * already saved are left out.
 */
export async function soundsLikeFor(playlist: PlaylistRecord, context: AdapterContext): Promise<SoundsLikeSuggestions> {
  const none = (status: SoundsLikeStatus): SoundsLikeSuggestions => ({ status, artists: [] });
  if (!playlist.spotifyArtistId) return none("no_artist");
  const alikes = playlist.qlooArtistId ? [] : playlist.soundsLike.flatMap((a) => (a.qlooId ? [a.qlooId] : [])).slice(0, SOUNDS_LIKE_SIGNAL);
  if (!playlist.qlooArtistId && alikes.length === 0) return none(playlist.spotifyProfile ? "unknown_artist" : "not_loaded");
  const signal = playlist.qlooArtistId ? [playlist.qlooArtistId] : alikes;
  const result = await tasteArtists(signal, SOUNDS_LIKE_TAKE + 2 + (playlist.qlooArtistId ? 0 : playlist.soundsLike.length), context);
  if (result.mode === "fallback") return none("unavailable");
  const own = playlist.spotifyProfile ? nameKey(playlist.spotifyProfile.name) : null;
  const saved = playlist.qlooArtistId ? new Set<string>() : new Set(playlist.soundsLike.map((a) => nameKey(a.name)));
  const artists = result.data.artists
    .filter((a) => !signal.includes(a.id) && nameKey(a.name) !== own && !saved.has(nameKey(a.name)))
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
/** Fewer resolved than this and the search widens to the similar artists of the top similar artists. */
export const WIDEN_BELOW = 3;
/** Similar artists whose own similar artists are taken, and the most second-step names looked up on Qloo. */
export const WIDEN_FROM = 2;
export const WIDEN_LOOKUPS = 8;
/** Sound-alikes the Hive keeps. */
export const FOUND_ALIKES_KEPT = 5;
/** Genre tags kept as the signal when no sound-alike resolves. */
export const GENRE_TAGS_KEPT = 3;
/** Genre texts looked up as Qloo tags (Spotify genres, then Last.fm tags), at most. */
export const GENRE_LOOKUPS = 12;
/** Last.fm tags kept per act after cleaning. */
export const LASTFM_TAGS_KEPT = 10;

export type FoundAlike = { name: string; qlooId: string; spotifyId?: string; image?: string };
export type FoundSoundAlikes =
  | { source: "lastfm"; alikes: FoundAlike[]; tags: []; similar: string[] }
  | { source: "genres"; alikes: []; tags: { id: string; name: string }[]; similar: string[] }
  | { source: "none"; alikes: []; tags: []; similar: string[] }
  | { source: "unavailable"; alikes: []; tags: []; similar: string[] };

/**
 * An act Qloo doesn't know (or only weakly) and the performer has no "Artists you sound like": the Hive finds some itself.
 * 1. Last.fm artist.getSimilar for the act, trying the name variants qloo-match makes until one gives artists.
 * 2. Each similar artist is looked up on Qloo with the same confidence rule as the act itself (decideMatch: only a certain
 *    match counts; a guess never does). A hit with no music-genre tag, or with the act's own Spotify id, is dropped. The first
 *    FOUND_ALIKES_KEPT that resolve are the signal.
 * 3. Fewer than WIDEN_BELOW resolve: the similar artists of the top WIDEN_FROM similar artists are looked up too (one more
 *    getSimilar each, better-known names), ranked after the first step's.
 * 4. None resolve: genre tags as Qloo genre tags (/v2/tags): the act's Spotify genres (and a genre the performer picked, first),
 *    then Last.fm artist.getTopTags cleaned of noise when those give no specific genre. Specific genres (dembow) are kept over broad
 *    ones (reggae); broad ones only when nothing specific resolves. Nothing there either: source "none".
 * "unavailable" means Qloo stopped answering (the caller treats it as an outage). Last.fm being down only skips its steps.
 */
export async function findSoundAlikes(act: { name: string; actName?: string | null; genres: readonly string[]; spotifyId?: string | null; /** A genre the performer picked: looked up first, kept even when broad. */ pick?: string | null; /** The act's own track titles (Last.fm track tags are read for the first few). */ tracks?: readonly string[] }, context: AdapterContext): Promise<FoundSoundAlikes> {
  const own = new Set([nameKey(act.name), nameKey(act.actName ?? "")].filter(Boolean));
  const variants = nameVariants([act.name, act.actName]).slice(0, SIMILAR_NAME_TRIES);
  let similar: string[] = [];
  for (const v of variants) {
    const res = await getSimilarArtists(v.text, context);
    if (res.mode === "fallback") break;
    similar = [...new Set(res.data.filter((a) => !own.has(nameKey(a.name))).map((a) => a.name))];
    if (similar.length > 0) break;
  }

  let attempts = 0;
  let outages = 0;
  const resolve = async (names: readonly string[]): Promise<FoundAlike[]> => {
    const res = await resolveGuarded(names.map((name) => ({ name })), own, act.spotifyId ?? null, context);
    attempts += res.attempts;
    outages += res.outages;
    return res.found;
  };
  const keep = (list: FoundAlike[]) => {
    const seen = new Set<string>();
    return list.filter((a) => !seen.has(a.qlooId) && seen.add(a.qlooId)).slice(0, FOUND_ALIKES_KEPT);
  };

  const tried = similar.slice(0, SIMILAR_LOOKUPS);
  let alikes = keep(await resolve(tried));
  if (alikes.length < WIDEN_BELOW && similar.length > 0) {
    const asked = new Set(tried.map(nameKey));
    const second: string[] = [];
    for (const name of similar.slice(0, WIDEN_FROM)) {
      const res = await getSimilarArtists(name, context);
      if (res.mode === "fallback") break;
      for (const a of res.data) {
        const k = nameKey(a.name);
        if (!own.has(k) && !asked.has(k)) {
          asked.add(k);
          second.push(a.name);
        }
      }
    }
    alikes = keep([...alikes, ...(await resolve(second.slice(0, WIDEN_LOOKUPS)))]);
  }
  if (alikes.length > 0) return { source: "lastfm", alikes, tags: [], similar };
  if (attempts > 0 && outages === attempts) return { source: "unavailable", alikes: [], tags: [], similar };

  // Genre texts: a genre the performer picked, then the Spotify genres, then Last.fm's tags for the act when those give no specific
  // genre. A specific genre (dembow, reggaeton) is the signal over a broad one (reggae, latin): broad ones count only when there is
  // nothing more specific, or the performer picked them.
  const picked: { id: string; name: string }[] = [];
  const specific: { id: string; name: string }[] = [];
  const coarse: { id: string; name: string }[] = [];
  const have = (id: string) => [...picked, ...specific, ...coarse].some((t) => t.id === id);
  let tagOutage = false;
  let lookedUp = 0;
  const lookUp = async (texts: readonly string[], into: "pick" | "act") => {
    for (const genre of texts) {
      if (specific.length >= GENRE_TAGS_KEPT || tagOutage || lookedUp >= GENRE_LOOKUPS) break;
      lookedUp++;
      const res = await resolveGenreTag(genre, context);
      if (res === "unavailable") {
        tagOutage = true;
        break;
      }
      if (!res || have(res.id)) continue;
      (into === "pick" ? picked : isCoarseGenre(res.name) || isCoarseGenre(genre) ? coarse : specific).push(res);
    }
  };
  const pickText = act.pick?.trim();
  if (pickText) await lookUp([pickText], "pick");
  const spotifyTexts = specificFirst([...new Set(act.genres.map((g) => g.trim()).filter((g) => g && g.toLowerCase() !== pickText?.toLowerCase()))].slice(0, 4));
  await lookUp(spotifyTexts, "act");
  if (specific.length === 0 && !tagOutage) {
    // Last.fm's tags for the act and its top tracks, weighted; only the ones it is clearly tagged with (a single weak tag never leads).
    const weighted = await actLastfmTags({ name: act.name, actName: act.actName, tracks: act.tracks ?? [] }, context);
    const names = weighted.filter((t) => t.confident && !spotifyTexts.some((g) => g.toLowerCase() === t.tag)).map((t) => t.tag);
    if (names.length > 0) await lookUp(specificFirst(names), "act");
  }
  const tags = [...picked, ...(specific.length ? specific : coarse)].slice(0, GENRE_TAGS_KEPT);
  if (tags.length > 0) return { source: "genres", alikes: [], tags, similar };
  return tagOutage && lookedUp > 0 ? { source: "unavailable", alikes: [], tags: [], similar } : { source: "none", alikes: [], tags: [], similar };
}

/** Genre texts with the specific ones first and the broad ones (isCoarseGenre) after, each group in its order. */
const specificFirst = (texts: readonly string[]) => [...texts.filter((t) => !isCoarseGenre(t)), ...texts.filter((t) => isCoarseGenre(t))];

/** Sound-alikes whose Last.fm tags are read for genre suggestions, and tags kept per sound-alike. */
export const SUGGEST_ALIKES = 5;
export const SUGGEST_TAGS_PER_ALIKE = 6;
/** Genre texts looked up as Qloo tags for the suggestions, at most, and suggestions kept. */
export const SUGGEST_LOOKUPS = 14;
export const SUGGEST_KEPT = 8;

/** The act's tracks whose Last.fm tags are read. */
export const ACT_TRACK_TAGS = 4;
/** A tag weighs its Last.fm count / 100, summed over its sources (the artist, each track): at least this and it is confident. */
export const CONFIDENT_WEIGHT = 0.5;

export type WeightedTag = { tag: string; weight: number; sources: number; confident: boolean };

const addTags = (into: Map<string, { weight: number; sources: number }>, tags: readonly { name: string; count: number }[], usable: readonly string[]) => {
  for (const tag of usable) {
    const count = tags.find((t) => t.name.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim() === tag)?.count ?? 0;
    const now = into.get(tag) ?? { weight: 0, sources: 0 };
    into.set(tag, { weight: now.weight + Math.max(0, Math.min(100, count)) / 100, sources: now.sources + 1 });
  }
};

/**
 * Last.fm's tags for an act: its artist tags (the first name variant that has any) and its first ACT_TRACK_TAGS tracks' tags,
 * cleaned (usableTagNames: no places, peoples, years or noise) and merged by weight, heaviest first. Confident: weight at least
 * CONFIDENT_WEIGHT (a weak tag stays weak however many tracks carry it a little). Logged, so a live run shows why.
 */
export async function actLastfmTags(act: { name: string; actName?: string | null; tracks?: readonly string[] }, context: AdapterContext): Promise<WeightedTag[]> {
  const actNames = [act.name, act.actName];
  const merged = new Map<string, { weight: number; sources: number }>();
  for (const v of nameVariants(actNames).slice(0, SIMILAR_NAME_TRIES)) {
    const res = await getTopTags(v.text, context);
    if (res.mode === "fallback") break;
    const usable = usableTagNames(res.data.map((t) => t.name), actNames, LASTFM_TAGS_KEPT);
    log.info("research lastfm tags", { for: "act", name: v.text, tags: res.data.slice(0, 15).map((t) => t.name), usable });
    if (usable.length > 0) {
      addTags(merged, res.data, usable);
      break;
    }
  }
  for (const title of [...new Set((act.tracks ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, ACT_TRACK_TAGS)) {
    const res = await getTrackTopTags(act.name, title, context);
    if (res.mode === "fallback") break;
    const usable = usableTagNames(res.data.map((t) => t.name), actNames, LASTFM_TAGS_KEPT);
    log.info("research lastfm tags", { for: "actTrack", name: act.name, track: title, tags: res.data.slice(0, 15).map((t) => t.name), usable });
    addTags(merged, res.data, usable);
  }
  return [...merged.entries()]
    .map(([tag, v]) => ({ tag, weight: Math.round(v.weight * 100) / 100, sources: v.sources, confident: v.weight >= CONFIDENT_WEIGHT }))
    .sort((x, y) => y.weight - x.weight || y.sources - x.sources);
}

/** A suggestion is `confident` when it may start selected: the act's own clear tags, or a tag at least two sound-alikes share. */
export type GenreSuggestion = { id: string; name: string; from: "act" | "alikes"; confident: boolean };

/**
 * Genres to suggest when the research asks for input, each as a Qloo genre tag (resolveGenreTag: an exact name or slug, or a
 * GENRE_SYNONYMS target, never a partial match) with Qloo's name:
 * 1. the act's own: a genre the performer picked and its Spotify genres (confident), then its Last.fm artist and track tags
 *    (actLastfmTags; confident when clear);
 * 2. its sound-alikes': each one's Last.fm artist tags and its top track's tags, most shared first; confident when at least two
 *    sound-alikes share it.
 * Specific genres lead broad ones within each group. A Qloo outage skips a genre; two in a row stop the lookups.
 */
export async function suggestGenres(act: { name: string; actName?: string | null; genres: readonly string[]; pick?: string | null; tracks?: readonly string[] }, alikes: readonly string[], context: AdapterContext): Promise<GenreSuggestion[]> {
  const actNames = [act.name, act.actName];
  const own: { text: string; confident: boolean }[] = [...(act.pick?.trim() ? [act.pick.trim()] : []), ...act.genres.map((g) => g.trim()).filter(Boolean)].map((text) => ({ text, confident: true }));
  for (const t of await actLastfmTags(act, context)) own.push({ text: t.tag, confident: t.confident });
  const shared = new Map<string, { alikes: number; weight: number; first: number }>();
  let order = 0;
  for (const name of alikes.slice(0, SUGGEST_ALIKES)) {
    const res = await getTopTags(name, context);
    if (res.mode === "fallback") break;
    const mine = new Map<string, { weight: number; sources: number }>();
    const usable = usableTagNames(res.data.map((t) => t.name), [name, ...actNames], SUGGEST_TAGS_PER_ALIKE);
    log.info("research lastfm tags", { for: "soundAlike", name, tags: res.data.slice(0, 15).map((t) => t.name), usable });
    addTags(mine, res.data, usable);
    const top = await getSongs([name], context).catch(() => null);
    const title = top && top.mode !== "fallback" ? Object.values(top.data)[0]?.[0]?.title : undefined;
    if (title) {
      const tr = await getTrackTopTags(name, title, context);
      if (tr.mode !== "fallback") {
        const trackUsable = usableTagNames(tr.data.map((t) => t.name), [name, ...actNames], SUGGEST_TAGS_PER_ALIKE);
        log.info("research lastfm tags", { for: "soundAlikeTrack", name, track: title, tags: tr.data.slice(0, 15).map((t) => t.name), usable: trackUsable });
        addTags(mine, tr.data, trackUsable);
      }
    }
    for (const [tag, v] of mine) {
      const now = shared.get(tag) ?? { alikes: 0, weight: 0, first: order++ };
      shared.set(tag, { alikes: now.alikes + 1, weight: now.weight + v.weight, first: now.first });
    }
  }
  const fromAlikes = [...shared.entries()].sort((a, b) => b[1].alikes - a[1].alikes || b[1].weight - a[1].weight || a[1].first - b[1].first).map(([text, v]) => ({ text, confident: v.alikes >= 2 }));
  const ordered = (list: { text: string; confident: boolean }[]) => [...list.filter((t) => !isCoarseGenre(t.text)), ...list.filter((t) => isCoarseGenre(t.text))];
  const seenText = new Set<string>();
  const texts = [...ordered(own).map((t) => ({ ...t, from: "act" as const })), ...ordered(fromAlikes).map((t) => ({ ...t, from: "alikes" as const }))].filter((t) => {
    const k = normGenre(t.text);
    return k && !seenText.has(k) && seenText.add(k);
  });
  const out: GenreSuggestion[] = [];
  let lookedUp = 0;
  let misses = 0;
  for (const { text, from, confident } of texts) {
    if (out.length >= SUGGEST_KEPT || lookedUp >= SUGGEST_LOOKUPS) break;
    lookedUp++;
    const tag = await resolveGenreTag(text, context);
    // Qloo didn't answer this one (even after its retry): two in a row and the rest aren't tried.
    if (tag === "unavailable") {
      if (++misses >= 2) break;
      continue;
    }
    misses = 0;
    if (!tag) continue;
    const same = out.find((t) => t.id === tag.id || normGenre(t.name) === normGenre(tag.name));
    // Two labels for one genre (cubaton and reggaeton) make it surer.
    if (same) same.confident = same.confident || confident;
    else out.push({ id: tag.id, name: titleGenre(tag.name), from, confident });
  }
  return out;
}

/** A /v2/tags name without live Qloo's noise: stray quotes, " - " in compounds, extra spaces. */
export const cleanTagName = (name: string) => name.replace(/["\u201c\u201d]/g, "").replace(/\s+-\s+/g, " ").replace(/\s+/g, " ").trim();

/** Genres the ask's genre search offers per query. */
export const GENRE_SEARCH_TAKE = 8;

/**
 * The ask's genre search (GET /api/genres): Qloo genre tags whose name matches the text, music genres only (urn:tag:genre:music and
 * Qloo's own genre tags), never a place or a people, once each by name. Exact names first, then names starting with the text.
 * The text's synonyms (GENRE_SYNONYMS) are searched too. "unavailable" when Qloo answered none of the searches.
 */
export async function searchGenres(text: string, context: AdapterContext): Promise<{ id: string; name: string }[] | "unavailable"> {
  const q = text.trim();
  if (!q || isPlaceOrPeopleTag(q)) return [];
  const found: { id: string; name: string }[] = [];
  let answered = 0;
  let asked = 0;
  for (const t of [q, ...genreSearchTexts(q).filter((x) => normGenre(x) !== normGenre(q))].slice(0, 3)) {
    for (const types of ["urn:tag:genre:music", "urn:tag:genre"] as const) {
      asked++;
      const res = await searchGenreTags(t, 10, context, types);
      if (res.mode === "fallback") continue;
      answered++;
      for (const tag of res.data) {
        const name = titleGenre(cleanTagName(tag.name));
        if (!isGenreTagId(tag.id) || !name || isPlaceOrPeopleTag(name) || isPlaceOrPeopleTag(tagSlug(tag.id)) || !isMusicGenreTag({ id: tag.id, name })) continue;
        if (!found.some((f) => f.id === tag.id || normGenre(f.name) === normGenre(name))) found.push({ id: tag.id, name });
      }
    }
  }
  if (asked > 0 && answered === 0) return "unavailable";
  const want = normGenre(q);
  const rank = (name: string) => (normGenre(name) === want ? 0 : normGenre(name).startsWith(want) ? 1 : 2);
  return found
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f.name) - rank(b.f.name) || a.i - b.i)
    .map((x) => x.f)
    .slice(0, GENRE_SEARCH_TAKE);
}

/** A genre tag's name as the page shows it: "dembow" is "Dembow", "hip hop" is "Hip Hop". */
export const titleGenre = (name: string) => name.trim().replace(/\b\w/g, (c) => c.toUpperCase());

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const foundOf = (e: QlooEntity): FoundAlike => ({
  name: e.name,
  qlooId: e.id,
  ...(e.spotifyId && SPOTIFY_ID.test(e.spotifyId) ? { spotifyId: e.spotifyId } : {}),
  ...(e.image && /^https:\/\//.test(e.image) && e.image.length <= 500 ? { image: e.image } : {}),
});

/**
 * Artists looked up on Qloo with the act's own confidence rule: a Spotify id from the picker is Qloo's certain id lookup; a name is
 * a /search the rule must accept (decideMatch: a guess never counts). A hit with no music-genre tag, with the act's name, or with
 * the act's own Spotify id is dropped. `unknown` lists the names Qloo had nothing certain for; `outages` the lookups Qloo didn't answer.
 */
async function resolveGuarded(artists: readonly { name: string; spotifyId?: string | null; image?: string | null }[], own: ReadonlySet<string>, actSpotifyId: string | null, context: AdapterContext) {
  let attempts = 0;
  let outages = 0;
  // The act's own name and Spotify id never count. A certain Spotify-id match needs no genre tag (the id is the proof, and Qloo's
  // /entities tags on an id lookup aren't always music-genre ids); a name match must have one, or it may be a namesake with no taste data.
  const usable = (e: QlooEntity | undefined | null, certain: boolean): e is QlooEntity => Boolean(e && !own.has(nameKey(e.name)) && (certain || hasMusicGenre(e)) && !(actSpotifyId && e.spotifyId === actSpotifyId));
  // The Spotify photo the performer picked leads; Qloo's is the fallback.
  const photo = (found: FoundAlike, artist: { image?: string | null }): FoundAlike => (artist.image && /^https:\/\//.test(artist.image) && artist.image.length <= 500 ? { ...found, image: artist.image } : found);
  const settled = await settleWithLimit(artists, 3, async (artist): Promise<FoundAlike | null> => {
    const pickedId = artist.spotifyId && SPOTIFY_ID.test(artist.spotifyId) ? artist.spotifyId : null;
    if (pickedId) {
      attempts++;
      const byId = await resolveSpotifyArtists([pickedId], context);
      if (byId.mode === "fallback") outages++;
      else {
        // The id lookup is exact; take the entity carrying that id when it returns several.
        const hit = byId.data.find((x) => x.spotifyId === pickedId) ?? byId.data[0];
        if (usable(hit, true)) return photo(foundOf(hit), artist);
      }
    }
    attempts++;
    const res = await searchArtistHits(artist.name, context);
    if (res.mode === "fallback") {
      outages++;
      return null;
    }
    // A name hit carrying another Spotify id than the picked one is a namesake.
    const pool = res.data.filter((x) => !isOtherSpotifyArtist(x.spotifyId, pickedId));
    const decision = decideMatch(pool.map(toMatchCandidate), nameVariants([artist.name]), []);
    if (decision.kind !== "match") return null;
    const e = pool.find((x) => x.id === decision.best.id);
    return usable(e, pickedId !== null && e?.spotifyId === pickedId) ? photo(foundOf(e), artist) : null;
  });
  const matches = settled.map((s) => (s.status === "fulfilled" ? s.value : null));
  const found = matches.filter((m): m is FoundAlike => m !== null);
  const unknown = artists.filter((_, i) => !matches[i]).map((a) => a.name);
  return { found, matches, unknown, attempts, outages };
}

/**
 * The performer's answer to a paused run: the artists they sound like, resolved on Qloo with the guarded match above. `unavailable`
 * when Qloo answered none of the lookups.
 */
export async function resolveSoundAlikes(
  artists: readonly { name: string; spotifyId?: string | null; image?: string | null }[],
  act: { name: string; actName?: string | null; spotifyId?: string | null },
  context: AdapterContext,
): Promise<{ found: FoundAlike[]; matches: (FoundAlike | null)[]; unknown: string[]; unavailable: boolean }> {
  const own = new Set([nameKey(act.name), nameKey(act.actName ?? "")].filter(Boolean));
  const res = await resolveGuarded(artists, own, act.spotifyId ?? null, context);
  const seen = new Set<string>();
  const found = res.found.filter((a) => !seen.has(a.qlooId) && seen.add(a.qlooId));
  return { found, matches: res.matches, unknown: res.unknown, unavailable: res.attempts > 0 && res.outages === res.attempts };
}

/**
 * A genre text as one Qloo music-genre tag. The genre buttons map straight to their known tag ids (no search); any other text is
 * a /v2/tags search matched by id slug or normalised name (pickGenreTag). "unavailable" when Qloo didn't answer.
 */
export async function resolveGenreTag(genre: string, context: AdapterContext): Promise<{ id: string; name: string } | null | "unavailable"> {
  // A place, a people or a language is never a genre: not looked up at all.
  if (isPlaceOrPeopleTag(genre)) {
    log.info("genre tag lookup", { text: genre, result: null, why: "place or people" });
    return null;
  }
  const known = buttonGenreTag(genre);
  if (known) return known;
  // The label itself, then its synonyms (GENRE_SYNONYMS: "cubaton" is also looked up as "reggaeton"), until one resolves.
  const tried: string[] = [];
  for (const text of genreSearchTexts(genre)) {
    const button = buttonGenreTag(text);
    if (button && text !== genre) {
      log.info("genre tag lookup", { text: genre, tried: [...tried, text], result: button.id });
      return button;
    }
    tried.push(text);
    const res = await searchGenreTags(text, 8, context);
    if (res.mode === "fallback") {
      log.info("genre tag lookup", { text: genre, tried, result: "unavailable" });
      return "unavailable";
    }
    let hit = pickGenreTag(res.data, text);
    if (!hit) {
      // Many specific genres are Qloo's own tags (urn:tag:genre:qloo:reggaeton), which the music-only search never returns.
      const wide = await searchGenreTags(text, 8, context, "urn:tag:genre");
      if (wide.mode !== "fallback") hit = pickGenreTag(wide.data, text, { broad: true });
    }
    if (hit) {
      const tag = { id: hit.id, name: cleanTagName(hit.name) };
      log.info("genre tag lookup", { text: genre, tried, result: tag.id, name: tag.name });
      return tag;
    }
  }
  log.info("genre tag lookup", { text: genre, tried, result: null });
  return null;
}
