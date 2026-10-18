/**
 * Inline mentions (user feedback U05/U08, 18 Oct 2026): an artist, a song or a data source named inside a sentence is drawn
 * inline (BRAND's Mention component: a small hex photo or cover plus the name in brand orange, or the source's logo), never as a
 * plain name or a chip row under the text. DEV builds the text as `RichText`; Reason and the agent-step cards render it.
 * Client-safe, no I/O.
 */
export type MentionSource = "spotify" | "lastfm" | "qloo";

export type Mention =
  | { kind: "artist"; name: string; image?: string | null; /** open.spotify.com/artist/… when known; otherwise not a link (U06). */ href?: string | null; /** 0–100, e.g. an explained weight. */ score?: number | null }
  | { kind: "song"; title: string; artist?: string | null; image?: string | null; /** open.spotify.com/track/… when known. */ href?: string | null }
  | { kind: "source"; source: MentionSource };

/** A sentence: plain text pieces and mentions, in reading order. */
export type RichText = (string | Mention)[];

export const SPOTIFY_ARTIST_URL = (id: string) => `https://open.spotify.com/artist/${id}`;
export const SPOTIFY_TRACK_URL = (id: string) => `https://open.spotify.com/track/${id}`;

/** Only a Spotify link is a link (U06): anything else (Last.fm, Qloo pages) is dropped. */
export const spotifyHref = (url: string | null | undefined): string | null => (url && /^https:\/\/open\.spotify\.com\/(artist|track|album)\//.test(url) ? url : null);

export const artist = (name: string, extra: Omit<Extract<Mention, { kind: "artist" }>, "kind" | "name"> = {}): Mention => ({ kind: "artist", name, ...extra, href: spotifyHref(extra.href) });
export const song = (title: string, extra: Omit<Extract<Mention, { kind: "song" }>, "kind" | "title"> = {}): Mention => ({ kind: "song", title, ...extra, href: spotifyHref(extra.href) });
export const source = (s: MentionSource): Mention => ({ kind: "source", source: s });

/** "A, B and C" with each item a mention (or text), for lists inside a sentence. */
export function listOf(items: (string | Mention)[]): RichText {
  const out: RichText = [];
  items.forEach((item, i) => {
    if (i > 0) out.push(i === items.length - 1 ? " and " : ", ");
    out.push(item);
  });
  return out;
}

/** The plain words of a RichText (aria labels, copy-to-clipboard, tests). */
export const plainText = (text: RichText): string =>
  text.map((p) => (typeof p === "string" ? p : p.kind === "artist" ? p.name : p.kind === "song" ? p.title : p.source === "lastfm" ? "Last.fm" : p.source === "qloo" ? "Qloo" : "Spotify")).join("");
