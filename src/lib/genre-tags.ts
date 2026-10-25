import { isWorldPlaceName } from "./world-places";

/** Tag id markers that say a Qloo tag is about a place, not a style of music. */
const PLACE_TAG_MARKERS = [":location", ":place", ":country", ":city", ":region", ":geo", ":nationality", ":language"];

/**
 * Whether a Qloo tag belongs in "Your sound in genres" (U30): "Your sound: Reggaeton, Cumbia, Argentina" must not list a country.
 * A tag is out when its id marks a place, or when its id is not a music-genre one and carries a type of another kind; and, as a
 * backstop, when its name is exactly a listed world city or country.
 */
export function isMusicGenreTag(tag: { id: string; name: string }): boolean {
  const id = tag.id.toLowerCase();
  if (PLACE_TAG_MARKERS.some((m) => id.includes(m))) return false;
  if (id.startsWith("urn:tag:") && !id.startsWith("urn:tag:genre:music") && !id.startsWith("urn:tag:genre:qloo") && !id.startsWith("urn:tag:genre:media")) return false;
  return !isWorldPlaceName(tag.name);
}

const plainWords = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Words that name a people, a language or a region rather than a style of music. Live Last.fm tags and Qloo /v2/tags results
 * both carry them as "genres" (Last.fm "cuban", "spanish"; Qloo urn:tag:genre:music:american, "CUBA", "Germany").
 */
const PEOPLE_WORDS = new Set(
  (
    "american americans argentine argentinian australian austrian belgian bolivian brazilian british canadian caribbean chilean chinese colombian " +
    "cuban cubana cubano danish dominican dutch ecuadorian english european finnish french german ghanaian greek guatemalan haitian " +
    "hispanic honduran indian irish italian jamaican japanese korean latinoamericano latinoamericana mexican mexicano mexicana " +
    "nigerian norwegian panamanian paraguayan peruvian polish portuguese puertorriqueno russian salvadoran scottish " +
    "spanish espanol espanola castellano swedish swiss turkish uruguayan venezuelan welsh african asian music musica musique"
  ).split(" "),
);
/** Peoples and regions of more than one word. */
const PEOPLE_PHRASES = ["latin american", "costa rican", "puerto rican", "south african", "en espanol"];

/**
 * Whether a tag name (or a Last.fm tag) is a place, a people or a language, never a genre: "Cuba", "cuban", "spanish", "Latin America",
 * "Brazilian Music". A genre that carries a place ("Cuban Urban", "Australian Hip Hop", "Latin Pop") is still a genre. A country
 * may hint at where the fans are, but it is never the act's genre.
 */
export function isPlaceOrPeopleTag(name: string): boolean {
  const text = plainWords(name);
  if (!text) return true;
  if (isWorldPlaceName(text)) return true;
  let rest = ` ${text} `;
  for (const phrase of PEOPLE_PHRASES) rest = rest.replaceAll(` ${phrase} `, " ");
  const words = rest.trim().split(" ").filter(Boolean);
  return words.every((w) => PEOPLE_WORDS.has(w) || isWorldPlaceName(w));
}

/**
 * Common labels for Latin urban music, as Last.fm and Spotify write them, to the genre names Qloo has tags for (live, 20 Oct:
 * urn:tag:genre:qloo:reggaeton, urn:tag:genre:cubaton, urn:tag:genre:music:trap, urn:tag:genre:qloo:cuban_urban). Data, not
 * per artist: each label is looked up as itself first, then as these, in order, until one resolves.
 */
export const GENRE_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  cubaton: ["reggaeton"],
  "cuban reggaeton": ["cuban urban", "reggaeton"],
  reparto: ["cuban urban", "reggaeton"],
  "cuban urban": ["reggaeton"],
  regueton: ["reggaeton"],
  "reggaeton latino": ["reggaeton"],
  perreo: ["reggaeton"],
  dembow: ["reggaeton"],
  "dominican dembow": ["dembow", "reggaeton"],
  "latin urban": ["urbano latino", "reggaeton"],
  "urban latin": ["urbano latino", "reggaeton"],
  "urbano latino": ["latin urban", "reggaeton"],
  "urban latino": ["urbano latino", "reggaeton"],
  urban: ["urbano latino", "reggaeton"],
  urbano: ["urbano latino", "reggaeton"],
  "musica urbana": ["urbano latino", "reggaeton"],
  "latin trap": ["trap latino", "trap"],
  "trap latino": ["latin trap", "trap"],
  "latin hip hop": ["latin rap", "hip hop"],
  "latin rap": ["latin hip hop", "hip hop"],
  "rap latino": ["latin hip hop", "hip hop"],
  "hip hop latino": ["latin hip hop", "hip hop"],
  "rap cubano": ["latin hip hop", "hip hop"],
};

/** Labels too vague to look up as themselves ("urban" matched "Urban Gospel"): only their synonyms are. */
const VAGUE_LABELS = new Set(["urban", "urbano"]);

/** The texts to look up for a genre label: itself (unless it is vague), then its synonyms (GENRE_SYNONYMS), once each. */
export function genreSearchTexts(text: string): string[] {
  const key = plainWords(text);
  const out = VAGUE_LABELS.has(key) ? [] : [text.trim()];
  for (const s of GENRE_SYNONYMS[key] ?? GENRE_SYNONYMS[text.trim().toLowerCase()] ?? []) if (!out.some((o) => plainWords(o) === plainWords(s))) out.push(s);
  return out.filter(Boolean);
}
