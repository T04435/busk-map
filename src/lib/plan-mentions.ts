import { artist, type Mention, song, SPOTIFY_ARTIST_URL, SPOTIFY_TRACK_URL, spotifyHref } from "@/lib/mention";
import type { Plan } from "@/lib/plan-schema";

/**
 * Every artist and song a plan knows (its set, the crowd, the local scene), as mentions, so the names inside its prose (the
 * summary, the notes, each pitch's why, the set reasons) are drawn in place by `mentionsIn` (U05). Photos and Spotify links
 * where the plan carries them; a name without either is still a mention, the sentence never repeats it.
 */
export function planMentions(plan: Plan): Mention[] {
  const out: Mention[] = [];
  const crowd = plan.crowd;
  for (const a of crowd?.localArtists ?? []) out.push(artist(a.name, { image: a.image, href: a.spotifyId ? SPOTIFY_ARTIST_URL(a.spotifyId) : null }));
  for (const a of crowd?.localScene?.acts ?? []) out.push(artist(a.name, { image: a.image }));
  for (const a of crowd?.usualCrowd?.artists ?? []) out.push(artist(a.name));
  for (const d of crowd?.drivers ?? []) out.push(artist(d.name));
  for (const p of plan.pitches) {
    for (const s of p.setlist ?? []) {
      out.push(artist(s.artist, { image: s.artistImage }));
      const track = s.suggestion?.spotifyTrackId ? SPOTIFY_TRACK_URL(s.suggestion.spotifyTrackId) : spotifyHref(s.suggestion?.sourceUrl);
      out.push(song(s.title, { artist: s.artist, image: s.suggestion?.image, href: track }));
    }
  }
  return out;
}
