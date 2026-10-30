import type { FilledBy } from "./notonq";
import { isPlaceOrPeopleTag } from "./genre-tags";
/**
 * Finding the act on Qloo without picking the wrong artist. Pure, client-safe, no I/O: the name variants worth searching,
 * the confidence rule, and the decision (a certain match, a short list for the user to confirm, or nothing).
 *
 * The rule, in one place:
 * - A candidate's NAME score is its best match against the act's name variants: 1.0 when its normalised name (lowercase,
 *   accents, punctuation and a leading "The" ignored) equals the Spotify name or the act name, also with "feat." and
 *   bracketed parts removed; 0.8 when it only equals a SHORT form ("Al2 El Aldeano" -> "Al2"); otherwise 0.85 x the
 *   bigram similarity of the closest name (so a near miss never reaches the accept bar by itself).
 * - A shared genre with the Spotify profile adds 0.1. A one-word name (a bare first name) whose genres share nothing with the
 *   profile's is capped at 0.85, so it is asked about, never accepted ("Fabrizio" the Spanish-language singer is not the Dutch one). Popularity only orders candidates of equal score.
 * - A candidate is ACCEPTED silently at a score of 0.9 or more AND a margin of 0.1 over the runner-up. A name two namesakes
 *   share is therefore settled only by the genre bonus; otherwise the user is asked.
 * - Below that, candidates scoring 0.55 or more (top three) are SHOWN for the user to confirm; none scoring that is "not found".
 */

export const ACCEPT_SCORE = 0.9;
export const ASK_SCORE = 0.55;
export const MARGIN = 0.1;
export const GENRE_BONUS = 0.1;
export const SHORT_BASE = 0.8;
export const NEAR_FACTOR = 0.85;
/** The most a one-word name scores when its genres share nothing with the Spotify profile's: under ACCEPT_SCORE, so the user is asked. */
export const GENERIC_NAME_CAP = 0.85;
/** Name searches on top of the Spotify name itself. */
export const MAX_EXTRA_SEARCHES = 4;
export const MAX_CANDIDATES = 3;

const plain = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "");
/** Lowercase, accents and punctuation off, "&" read as "and", a leading "the" off. */
export function normName(name: string): string {
  return plain(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the\s+/, "");
}
/** Like normName but keeping "the": two searches that differ only by it stay two searches. */
const searchKey = (name: string) =>
  plain(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** The name with bracketed parts and a trailing "feat. X" removed. */
export function cleanName(name: string): string {
  return name
    .replace(/\s*[([{][^)\]}]*[)\]}]/g, "")
    .replace(/\s+(?:feat|ft|featuring|with|con)\.?\s.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The leading part of a longer stage name ("Al2 El Aldeano" -> "Al2", "Ana y Los Soles" -> "Ana"); null when the name has no such seam. */
export function shortForm(name: string): string | null {
  const m = /^(.{2,}?)(?:\s+(?:el|la|los|las|y|and|x|&|\+|vs\.?|presents?)\s+|\s+[-–/]\s+|\s*,\s*)/i.exec(name);
  const head = m?.[1]?.trim();
  return head && head.length >= 2 && head.length < name.length ? head : null;
}

export type VariantKind = "exact" | "clean" | "short";
export type NameVariant = { text: string; kind: VariantKind };

/**
 * Every name worth searching, most trustworthy first, deduplicated (accents, case, punctuation; "The" on and off count as two).
 * `names` is the Spotify name first, then the act name when the performer changed it (the long or short form they use).
 */
export function nameVariants(names: readonly (string | null | undefined)[]): NameVariant[] {
  const out: NameVariant[] = [];
  const seen = new Set<string>();
  const add = (text: string | null | undefined, kind: VariantKind) => {
    const t = text?.replace(/\s+/g, " ").trim();
    if (!t || t.length < 2) return;
    const k = searchKey(t);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push({ text: t, kind });
  };
  const given = names.map((n) => n?.trim()).filter((n): n is string => Boolean(n));
  for (const n of given) add(n, "exact");
  for (const n of given) add(cleanName(n), "clean");
  for (const n of given) {
    const c = cleanName(n);
    // "The" on and off.
    add(/^the\s+/i.test(c) ? c.replace(/^the\s+/i, "") : `The ${c}`, "clean");
  }
  for (const n of given) add(shortForm(cleanName(n)), "short");
  return out;
}

/** The texts to send to /search: the Spotify name first, then at most MAX_EXTRA_SEARCHES more. */
export function searchPlan(names: readonly (string | null | undefined)[]): string[] {
  return nameVariants(names)
    .slice(0, 1 + MAX_EXTRA_SEARCHES)
    .map((v) => v.text);
}

function bigrams(s: string): string[] {
  const t = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}
/** Sørensen–Dice similarity of two names' character bigrams (0 to 1). */
export function similarity(a: string, b: string): number {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const left = bigrams(x);
  const right = bigrams(y);
  const pool = new Map<string, number>();
  for (const g of right) pool.set(g, (pool.get(g) ?? 0) + 1);
  let common = 0;
  for (const g of left) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      common++;
      pool.set(g, n - 1);
    }
  }
  return (2 * common) / (left.length + right.length);
}

const GENRE_STOP = new Set(["music", "and", "the", "pop"]);
const genreWords = (genres: readonly string[]) => new Set(genres.flatMap((g) => normName(g).split(" ")).filter((w) => w.length >= 3 && !GENRE_STOP.has(w)));
/** Whether two genre lists share a word ("indie folk" and "Folk"). "pop" alone is too broad to count. */
export function genreOverlap(a: readonly string[], b: readonly string[]): boolean {
  const left = genreWords(a);
  if (left.size === 0) return false;
  for (const w of genreWords(b)) if (left.has(w)) return true;
  return false;
}

export type MatchCandidate = { id: string; name: string; popularity: number | null; genres: string[]; image: string | null; /** NotOnQ filled it in, or offers it as a possible match (lib/notonq.ts). */ filledBy?: FilledBy };
export type ScoredCandidate = MatchCandidate & { score: number; basis: VariantKind | "near" };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function scoreCandidate(c: MatchCandidate, variants: readonly NameVariant[], profileGenres: readonly string[]): ScoredCandidate {
  const key = normName(c.name);
  let score = 0;
  let basis: ScoredCandidate["basis"] = "near";
  for (const v of variants) {
    const equal = normName(v.text) === key;
    const s = equal ? (v.kind === "short" ? SHORT_BASE : 1) : NEAR_FACTOR * similarity(v.text, c.name);
    if (s > score) {
      score = s;
      basis = equal ? v.kind : "near";
    }
  }
  if (genreOverlap(c.genres, profileGenres)) score += GENRE_BONUS;
  // A one-word name is shared by many artists: if both sides list genres and they have nothing in common, it is a namesake until the user says otherwise.
  else if (key.split(" ").length === 1 && c.genres.length > 0 && profileGenres.length > 0) score = Math.min(score, GENERIC_NAME_CAP);
  return { ...c, score: r2(score), basis };
}

export type MatchDecision =
  | { kind: "match"; best: ScoredCandidate; scored: ScoredCandidate[] }
  | { kind: "ask"; candidates: ScoredCandidate[] }
  | { kind: "none" };

/** The rule, applied to every candidate the searches found (deduplicated by id here). */
export function decideMatch(candidates: readonly MatchCandidate[], variants: readonly NameVariant[], profileGenres: readonly string[]): MatchDecision {
  const byId = new Map<string, MatchCandidate>();
  for (const c of candidates) if (!byId.has(c.id)) byId.set(c.id, c);
  const scored = [...byId.values()]
    .map((c) => scoreCandidate(c, variants, profileGenres))
    .sort((a, b) => b.score - a.score || (b.popularity ?? 0) - (a.popularity ?? 0) || a.name.localeCompare(b.name));
  const [best, second] = scored;
  if (!best || best.score < ASK_SCORE) return { kind: "none" };
  if (best.score >= ACCEPT_SCORE && (!second || r2(best.score - second.score) >= MARGIN)) return { kind: "match", best, scored };
  return { kind: "ask", candidates: scored.filter((c) => c.score >= ASK_SCORE).slice(0, MAX_CANDIDATES) };
}

/** What the page shows for one candidate. */
export type QlooCandidateView = { qlooId: string; name: string; image?: string; genres: string[]; /** "notonq": a possible match NotOnQ offers (Qloo lacks the name). Missing: null. */ filledBy?: FilledBy };

/** Whether a Qloo tag id is a music genre (`urn:tag:genre:music:folk`). */
export const isMusicGenreTagId = (id: string) => id.startsWith("urn:tag:genre:music");
/** An entity with no music-genre tag is a weak match: a name and an id, but nothing to read taste from. */
export const hasMusicGenre = (entity: { tags: readonly { id: string }[] }) => entity.tags.some((t) => isMusicGenreTagId(t.id));
/** A name hit whose Spotify id exists and is not the act's is another artist with the same name. No id on either side proves nothing. */
export const isOtherSpotifyArtist = (entitySpotifyId: string | null | undefined, actSpotifyId: string | null | undefined) => Boolean(entitySpotifyId && actSpotifyId && entitySpotifyId !== actSpotifyId);

const TAG_NOISE = new Set([
  "seen live", "favorites", "favourites", "favorite", "favourite", "male vocalists", "female vocalists", "male vocalist", "female vocalist", "spotify", "all", "music", "other", "unknown",
  "australian", "american", "british", "canadian", "irish", "scottish", "english", "melbourne", "sydney", "new york", "nyc", "brooklyn", "usa", "uk", "australia",
]);
/** Last.fm tag names fit to look up as Qloo genre tags: lowercased, trimmed, no "seen live", places, years or the act's own name; once each, in order. */
export function usableTagNames(tags: readonly string[], actNames: readonly (string | null | undefined)[] = [], max = 10): string[] {
  const acts = new Set(actNames.map((n) => normName(n ?? "")).filter(Boolean));
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
    if (t.length < 3 || t.length > 30 || /\d/.test(t) || TAG_NOISE.has(t) || isPlaceOrPeopleTag(t) || /\b(?:under|listeners|favou?rite|albums? i own|my )\b/.test(t) || acts.has(normName(t))) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// --- Genre tags (/v2/tags) ---

/**
 * The genre buttons' Qloo tag ids. Verified against live Qloo (media/qloo-coverage raw responses: /v2/tags and entity tags);
 * these never go through a search, so a noisy tag name can't make a button fail. Latin, Country and Classical are not
 * confirmed yet, so they are searched (and matched by id slug or name) instead.
 */
export const GENRE_BUTTON_TAGS: Readonly<Record<string, string>> = {
  folk: "urn:tag:genre:music:folk",
  rock: "urn:tag:genre:music:rock",
  pop: "urn:tag:genre:music:pop",
  "hip hop": "urn:tag:genre:music:hip_hop",
  jazz: "urn:tag:genre:music:jazz",
  electronic: "urn:tag:genre:music:electronic",
  blues: "urn:tag:genre:music:blues",
  soul: "urn:tag:genre:music:soul",
  reggae: "urn:tag:genre:music:reggae",
};

/** A genre text or a tag name compared the same way: no quotes, punctuation or case ("\"indie\"" and "Hip - Hop" read as "indie", "hip hop"). */
export function normGenre(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The slug of a Qloo genre tag id: urn:tag:genre:music:indie_folk is "indie folk". */
export const tagSlug = (id: string): string => normGenre(id.replace(/^urn:tag:genre(?::[a-z]+)?:/, "").replace(/_/g, " "));

/**
 * A Qloo genre tag id fit for a taste signal: `urn:tag:genre:music:…`, or Qloo's own genre tags `urn:tag:genre:qloo:…`. Live Qloo
 * (media/qloo-coverage, 20 Oct) has many specific genres only as the latter (urn:tag:genre:qloo:reggaeton, …:cuban_urban), which a
 * /v2/tags search filtered to urn:tag:genre:music never returns. Plain `urn:tag:genre:<word>` ids are free-text labels (places too).
 */
export const isGenreTagId = (id: string) => /^urn:tag:genre:(?:music|qloo):[^\s,]+$/.test(id);

/** The genre buttons' names, normalised: broad genres. A specific genre (dembow, reggaeton) leads them as a signal. */
const COARSE_GENRES = new Set(["folk", "rock", "pop", "hip hop", "hiphop", "jazz", "electronic", "latin", "country", "blues", "soul", "reggae", "classical", "world", "dance", "rap", "indie", "alternative", "urban"]);
/** Whether a genre text or tag name is a broad genre (one of the buttons' kind) rather than a specific one. */
export const isCoarseGenre = (text: string) => COARSE_GENRES.has(normGenre(text));

/** The button tag for a genre text, when it is one of the buttons' genres. */
export function buttonGenreTag(genre: string): { id: string; name: string } | null {
  const key = normGenre(genre);
  const id = GENRE_BUTTON_TAGS[key];
  return id ? { id, name: key.replace(/\b\w/g, (c) => c.toUpperCase()) } : null;
}

/**
 * The tag a /v2/tags search result list gives for a genre text: an exact match on the id slug or the normalised name first, then
 * the same with spaces removed ("singer-songwriter" and "Singersongwriter"). Never a partial match: "urban" is not "Urban Gospel"
 * (live, 25 Oct); related labels go through GENRE_SYNONYMS instead. Music-genre tags only, never a place. Null when nothing fits.
 */
export function pickGenreTag(tags: readonly { id: string; name: string }[], genre: string, options: { broad?: boolean } = {}): { id: string; name: string } | null {
  const want = normGenre(genre);
  if (!want) return null;
  // Never a place, a people or a language (Qloo has urn:tag:genre:music:american and a "CUBA" tag): a genre only.
  if (isPlaceOrPeopleTag(genre)) return null;
  const music = tags.filter((t) => (options.broad ? isGenreTagId(t.id) : t.id.startsWith("urn:tag:genre:music")) && !isPlaceOrPeopleTag(t.name) && !isPlaceOrPeopleTag(tagSlug(t.id)));
  const exact = music.find((t) => tagSlug(t.id) === want || normGenre(t.name) === want);
  if (exact) return exact;
  const squashed = want.replace(/ /g, "");
  const flat = music.find((t) => tagSlug(t.id).replace(/ /g, "") === squashed || normGenre(t.name).replace(/ /g, "") === squashed);
  return flat ?? null;
}
