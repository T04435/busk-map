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

/** `fill=<1-8>` and `skip=Title~Artist|…`: the suggested-fill count and the songs left out of it. Absent means off. */
export function parseFillParam(fill: string | undefined, skip: string | undefined): Pick<Performer, "fillSuggested" | "skipSongs"> {
  const count = fill !== undefined && /^[1-8]$/.test(fill) ? Number(fill) : undefined;
  if (count === undefined) return {};
  const skipSongs = parseSongsParam(skip).map(({ title, artist }) => ({ title, artist }));
  return { fillSuggested: count, ...(skipSongs.length ? { skipSongs } : {}) };
}

/** The fill and skip params for a performer; empty when the fill is off, so old links stay unchanged. */
export function fillParam(performer: Pick<Performer, "fillSuggested" | "skipSongs">): [string, string][] {
  if (!performer.fillSuggested) return [];
  const out: [string, string][] = [["fill", String(performer.fillSuggested)]];
  if (performer.skipSongs?.length) out.push(["skip", songsParam(performer.skipSongs.map((s) => ({ ...s, own: false })))]);
  return out;
}

/**
 * `own=<qlooId>~<name>~<spotify id>`: the act's own artist on Qloo (the Spotify id is optional). Absent when there is none, so old
 * links stay unchanged. A "~" in the name is replaced on the way out.
 */
const QLOO_ID = /^[A-Za-z0-9-]{8,64}$/;

export function parseOwnParam(value: string | undefined): Pick<Performer, "ownArtist"> {
  if (!value) return {};
  const [qlooId, name, spotifyId] = value.split("~").map((s) => s.trim());
  if (!qlooId || !name || !QLOO_ID.test(qlooId)) return {};
  return { ownArtist: { qlooId, name: name.slice(0, 80), ...(spotifyId && SPOTIFY_ID.test(spotifyId) ? { spotifyId } : {}) } };
}

export function ownParam(performer: Pick<Performer, "ownArtist">): [string, string][] {
  const own = performer.ownArtist;
  if (!own) return [];
  return [["own", [own.qlooId, own.name.replaceAll("~", " "), own.spotifyId].filter(Boolean).join("~")]];
}
