/** Client-safe formatting of Qloo venue detail. */

/** Qloo's venue detail in a few words: "live music, pub, known for “bands”". */
export function venueDetail(place: { liveMusic?: boolean | null; goodFor?: string[]; keywords?: string[] }): string {
  const parts: string[] = [];
  if (place.liveMusic) parts.push("live music");
  const kind = place.goodFor?.[0];
  if (kind && !(place.liveMusic && /live music/i.test(kind))) parts.push(kind.toLowerCase());
  const words = (place.keywords ?? []).filter((k) => !(place.liveMusic && /live music/i.test(k))).slice(0, 2);
  if (words.length) parts.push(`known for ${words.map((k) => `“${k}”`).join(" and ")}`);
  return parts.join(", ");
}
