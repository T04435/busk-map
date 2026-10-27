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

/**
 * The suburb (or town, or district) in a Qloo place's address: the part after the street, without its state code, postcode
 * or country. "12 Crown St, Surry Hills NSW 2010, Australia" → "Surry Hills". Null when no such part reads as a name.
 */
export function suburbOf(address: string | null | undefined): string | null {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  // After the street (and any unit line before it); the last part is the country when there are three or more.
  const middle = parts.slice(1, parts.length >= 3 ? -1 : undefined);
  for (const part of [...middle, ...(parts.length >= 3 ? parts.slice(-1) : [])]) {
    const name = part
      .replace(/\s+[A-Z]{2,3}\s+\d{3,6}(-\d+)?$/, "")
      .replace(/\s+\d{3,6}(-\d+)?$/, "")
      .replace(/^\d{3,6}(-\d+)?\s+/, "")
      .replace(/\s+[A-Z]{2,3}$/, "")
      .trim();
    if (/^[^\d]{2,40}$/u.test(name) && /\p{L}/u.test(name)) return name;
  }
  return null;
}

/** The suburbs a set of Qloo places sits in, each at the centre of its places: the named areas when no map source has them. */
export function suburbsOfPlaces(places: readonly { lat: number; lon: number; address?: string | null }[]): { name: string; lat: number; lon: number; count: number }[] {
  const by = new Map<string, { name: string; lat: number; lon: number; count: number }>();
  for (const p of places) {
    const name = suburbOf(p.address);
    if (!name) continue;
    const key = name.toLowerCase();
    const s = by.get(key) ?? { name, lat: 0, lon: 0, count: 0 };
    s.lat = (s.lat * s.count + p.lat) / (s.count + 1);
    s.lon = (s.lon * s.count + p.lon) / (s.count + 1);
    s.count++;
    by.set(key, s);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
