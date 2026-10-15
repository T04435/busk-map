/**
 * Performer fields in plan and week links:
 *   artists=Paul Kelly~<spotify id>|Missy Higgins     (the id is optional: picked from search)
 *   songs=Title~Artist|Own Song~Me~own|Picked~Artist~215s   (flags after the artist: "own", length in seconds)
 * Older links without ids or lengths still parse.
 */
import type { PlanRequest } from "./plan-schema";

type Performer = PlanRequest["performer"];
type Song = Performer["songs"][number];

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SECONDS = /^(\d{1,4})s$/;

const list = (value: string | undefined) => (value ? value.split("|").map((s) => s.trim()).filter(Boolean) : []);

export function parseArtistsParam(value: string | undefined): Pick<Performer, "artists" | "spotifyArtists"> {
  const artists: string[] = [];
  const spotifyArtists: Performer["spotifyArtists"] = [];
  for (const entry of list(value)) {
    const [name, id] = entry.split("~").map((s) => s.trim());
    if (!name) continue;
    artists.push(name);
    if (id && SPOTIFY_ID.test(id)) spotifyArtists.push({ name, id });
  }
  return { artists, spotifyArtists };
}

export function artistsParam(performer: Pick<Performer, "artists" | "spotifyArtists">): string {
  const ids = new Map((performer.spotifyArtists ?? []).map((a) => [a.name.toLowerCase(), a.id]));
  return performer.artists.map((name) => [name, ids.get(name.toLowerCase())].filter(Boolean).join("~")).join("|");
}

export function parseSongsParam(value: string | undefined): Song[] {
  return list(value).map((entry) => {
    const [title, artist, ...flags] = entry.split("~");
    const seconds = flags.map((f) => SECONDS.exec(f)?.[1]).find(Boolean);
    return {
      title,
      artist,
      own: flags.includes("own"),
      ...(seconds && Number(seconds) > 0 ? { durationMs: Number(seconds) * 1000 } : {}),
    };
  });
}

export function songsParam(songs: Song[]): string {
  return songs
    .map((s) => [s.title, s.artist, s.own ? "own" : "", s.durationMs ? `${Math.round(s.durationMs / 1000)}s` : ""].filter(Boolean).join("~"))
    .join("|");
}
