import "server-only";
import { LEARN_MAX_PER_ARTIST } from "@/server/playlist/config";
import { rankKey, templateReason, templateSummary, type AcceptedAnswer, type ArtistInfo, type LearnState } from "./tools";

/** At most this many picks from the data alone (docs §2.6). */
export const FALLBACK_PICKS = 6;

/**
 * The deterministic fallback (docs §2.6, the `setlist.ts:learnThese` ranking): used when the model fails, times out, hits
 * the step or token cap without an accepted answer, or ends with too few valid picks.
 *
 * Artists are ranked by Qloo audience growth, then the trend, then affinity (a bonus for one found both as a related
 * artist and at a pitch), then Last.fm listeners. Songs are this run's top_tracks results, 2 per artist at most, up to 6,
 * with template reasons that carry only facts the tools returned.
 */
export function rankArtists(state: Pick<LearnState, "artists">): ArtistInfo[] {
  return [...state.artists.values()].sort((a, b) => rankKey(b) - rankKey(a) || (b.listeners ?? 0) - (a.listeners ?? 0) || a.name.localeCompare(b.name));
}

export function fallbackAnswer(state: Pick<LearnState, "artists" | "found">): AcceptedAnswer | null {
  const byArtist = new Map<string, string[]>();
  for (const song of state.found.values()) byArtist.set(song.artistId, [...(byArtist.get(song.artistId) ?? []), song.songId]);
  const picks: AcceptedAnswer["picks"] = [];
  for (const artist of rankArtists(state)) {
    for (const songId of (byArtist.get(artist.id) ?? []).slice(0, LEARN_MAX_PER_ARTIST)) {
      if (picks.length >= FALLBACK_PICKS) break;
      picks.push({ songId, reason: templateReason(artist), buildsOn: null, templated: true });
    }
  }
  if (picks.length === 0) return null;
  return { picks, summary: templateSummary(picks.length), notes: [] };
}
