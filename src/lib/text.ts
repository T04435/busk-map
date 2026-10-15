/** Normalise a song title so remasters, edits and live takes collapse into one song. */
export function songKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[-–]\s*(remaster|radio edit|live|single|mono|stereo|demo|acoustic|edit|version|mix).*$/i, "")
    .replace(/\s*[([].*?(remaster|edit|live|version|mix|deluxe|demo|mono|stereo).*?[)\]]/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Case- and punctuation-insensitive key for artist names. */
export function nameKey(name: string): string {
  return name
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
