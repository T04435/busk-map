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
  if (id.startsWith("urn:tag:") && !id.startsWith("urn:tag:genre:music") && !id.startsWith("urn:tag:genre:media")) return false;
  return !isWorldPlaceName(tag.name);
}
