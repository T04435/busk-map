/**
 * How a Repertoire fills the planners (docs/playlist-architecture.md §3.1). Pure and client-safe.
 * The plan request is always a full snapshot of what the form held; the Repertoire's id never enters it.
 */
import { playlistSongKey, type PlaylistView } from "./playlist-schema";
import type { PlanRequest } from "./plan-schema";

type Performer = PlanRequest["performer"];

/** The songs a planner uses: the ones you can sing and the ones you learned. */
export function plannerSongs(view: Pick<PlaylistView, "songs">): Performer["songs"] {
  return view.songs.map((s) => ({ title: s.title, artist: s.artist, own: s.own, ...(s.durationMs ? { durationMs: s.durationMs } : {}) }));
}

/** The act as a planner request wants it: sounds-like artists (then the artists of songs that aren't yours, as the form adds them), at most 10. */
export function plannerPerformer(view: Pick<PlaylistView, "actName" | "soundsLike" | "songs">, fallbackName = "My act"): Performer {
  const songs = plannerSongs(view);
  const artists = [...new Set([...view.soundsLike.map((a) => a.name), ...songs.filter((s) => !s.own).map((s) => s.artist)])].slice(0, 10);
  const spotifyArtists = view.soundsLike.flatMap((a) => (a.spotifyId && artists.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : []));
  return { name: view.actName ?? fallbackName, artists, spotifyArtists, songs };
}

/** What "edited for this busk" compares: the act name, the sounds-like artists and the songs, order and case aside. */
export type Draft = { name: string; artists: string[]; songKeys: string[] };

const norm = (s: string) => s.trim().toLowerCase();

export function draftOf(input: { name: string; artists: string[]; songs: { title: string; artist: string }[] }): Draft {
  return {
    name: input.name.trim(),
    artists: input.artists.map(norm).sort(),
    songKeys: input.songs.map((s) => playlistSongKey(s.artist, s.title)).sort(),
  };
}

/** The Repertoire as a form draft (a Repertoire with no act name has an empty name). */
export const repertoireDraft = (view: Pick<PlaylistView, "actName" | "soundsLike" | "songs">): Draft =>
  draftOf({ name: view.actName ?? "", artists: view.soundsLike.map((a) => a.name), songs: view.songs });

export const sameDraft = (a: Draft, b: Draft) =>
  a.name === b.name && a.artists.length === b.artists.length && a.artists.every((x, i) => x === b.artists[i]) && a.songKeys.length === b.songKeys.length && a.songKeys.every((x, i) => x === b.songKeys[i]);

/** True when a request's songs are exactly the Repertoire's (and it has some): the busk was planned from it, unedited. */
export function songsMatchRepertoire(songs: { title: string; artist: string }[], view: { songs: { title: string; artist: string }[] }): boolean {
  if (view.songs.length === 0) return false;
  const a = songs.map((s) => playlistSongKey(s.artist, s.title)).sort();
  const b = view.songs.map((s) => playlistSongKey(s.artist, s.title)).sort();
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
