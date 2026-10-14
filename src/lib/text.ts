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
