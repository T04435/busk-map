import "server-only";
import { nameKey } from "@/lib/text";
import type { SoundsLikeSuggestions, SoundsLikeStatus, SpotifyProfile } from "@/lib/playlist-schema";
import type { AdapterContext } from "@/server/adapters/core";
import { resolveArtists, resolveSpotifyArtists, tasteArtists, type QlooEntity } from "@/server/adapters/qloo";
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
 * Loads the Spotify artist and finds the same artist in Qloo. Two Qloo lookups at most, both cached: the external-id
 * lookup first (it can't pick a namesake), then a name search accepted only when the name matches exactly.
 * Called when the link changes or on an explicit refresh, never on page load.
 */
export async function refreshOwnArtist(spotifyId: string, context: AdapterContext): Promise<ProfileRefresh> {
  const spotify = await getArtistProfile(spotifyId, context);
  if (!spotify.data) return { profile: null, qlooArtistId: null, qloo: "unavailable", spotify: spotify.reason === "not_found" ? "not_found" : "unavailable" };
  const profile = spotify.data;
  const found = await findOwnOnQloo(spotifyId, profile.name, context);
  return { profile, qlooArtistId: found.entity?.id ?? null, qloo: found.qloo, spotify: "ok" };
}

/**
 * The act's own artist on Qloo, from its Spotify id and name: the external-id lookup first (it can't pick a namesake), then
 * a name search accepted only when the name matches exactly. Shared by the profile refresh and Repertoire research step 3.
 */
export async function findOwnOnQloo(spotifyId: string, name: string, context: AdapterContext): Promise<{ entity: QlooEntity | null; qloo: ProfileRefresh["qloo"] }> {
  const byId = await resolveSpotifyArtists([spotifyId], context);
  let entity = byId.data[0] ?? null;
  let answered = byId.mode !== "fallback";
  if (!entity && answered) {
    const byName = await resolveArtists([name], context);
    answered = answered && byName.mode !== "fallback";
    const hit = byName.data[0]?.entity ?? null;
    if (hit && nameKey(hit.name) === nameKey(name)) entity = hit;
  }
  return { entity, qloo: entity ? "matched" : answered ? "unknown" : "unavailable" };
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
