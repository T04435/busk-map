import "server-only";
import { nameKey } from "@/lib/text";
import type { SoundsLikeSuggestions, SoundsLikeStatus, SpotifyProfile } from "@/lib/playlist-schema";
import type { AdapterContext } from "@/server/adapters/core";
import { decideMatch, MAX_EXTRA_SEARCHES, nameVariants, type MatchCandidate, type MatchDecision, type QlooCandidateView } from "@/lib/qloo-match";
import { resolveSpotifyArtists, searchArtistHits, tasteArtists, type QlooEntity } from "@/server/adapters/qloo";
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
