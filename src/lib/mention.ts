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

/**
 * The names inside a sentence, drawn in place (U05): every known entity the sentence names (an artist, a song) becomes its
 * Mention where it stands; nothing is tacked on after the sentence, and a name we don't know stays plain text. Matching is
 * on the row's known entities (fans-of artists, the song's artist, Repertoire songs, a step's artists), case-insensitive and on
 * whole words, longest name first, so it never relies on how the model formatted the sentence.
 */
export function mentionsIn(text: string, entities: readonly Mention[]): RichText {
  const nameOf = (m: Mention) => (m.kind === "artist" ? m.name : m.kind === "song" ? m.title : null);
  const known = new Map<string, Mention>();
  for (const e of entities) {
    const name = nameOf(e)?.trim();
    if (!name || name.length < 2) continue;
    const key = name.toLowerCase();
    const prev = known.get(key);
    // The first entity for a name wins, unless a later one has the photo or the link it lacks.
    if (!prev || (!("image" in prev && prev.image) && "image" in e && e.image) || (!("href" in prev && prev.href) && "href" in e && e.href)) known.set(key, e);
  }
  if (!text || known.size === 0) return text ? [text] : [];
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${[...known.keys()].sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const out: RichText = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(known.get(m[0].toLowerCase()) as Mention);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
