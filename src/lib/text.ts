/** Accents off ("Amándote" and "Amandote" are one song, U26). */
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "");

/**
 * Normalise a song title so remasters, edits, live takes and featured-artist credits collapse into one song: lowercase,
 * accents stripped, "(feat. X)" / "ft. X" dropped. A remix stays its own song ("Darte" and "Darte Remix" are two).
 */
export function songKey(title: string): string {
  return plain(title)
    .toLowerCase()
    .replace(/\s*[([]\s*(feat|ft|featuring|con|with)\.?\s[^)\]]*[)\]]/gi, "")
    .replace(/\s+(feat|ft|featuring)\.?\s.*$/i, "")
    .replace(/\s*[-–]\s*(remaster|radio edit|live|single|mono|stereo|demo|acoustic|edit|version|mix).*$/i, "")
    .replace(/\s*[([].*?(remaster|edit|live|version|mix|deluxe|demo|mono|stereo).*?[)\]]/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Case- and punctuation-insensitive key for artist names. */
export function nameKey(name: string): string {
  return plain(name)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Key for one song by one artist. */
export function trackKey(artist: string, title: string): string {
  return `${nameKey(artist)}|${songKey(title)}`;
}

const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "n", "of", "on", "or", "the", "to"]);

/**
 * Title case for display names that arrive in mixed case (Qloo genres come as
 * "indie" and "Alternative Rock"). Lowercase words are capitalised, minor words
 * stay lowercase except first, and anything already holding capitals ("R&B",
 * "UK Garage", "DJ") is left as it is. Hyphenated and slashed parts are cased
 * on their own ("hip-hop" → "Hip-Hop").
 */
export function titleCase(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, i) => {
      if (/\p{Lu}/u.test(word)) return word;
      if (i > 0 && MINOR_WORDS.has(word)) return word;
      return word.replace(/(^|[-/])(\p{Ll})/gu, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
    })
    .join(" ");
}
