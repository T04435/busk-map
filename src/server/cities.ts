import { cityLevels, cityOfRequest, isMelbourne, MELBOURNE, type City, type CityLevels, type CityPlace } from "@/lib/city";
import type { LatLon } from "@/lib/geo";
import { PUBLIC_SPOTS, USUAL_HOTSPOTS, type PublicSpot } from "@/server/data/spots";

/**
 * The city providers (V2 2.1). Every city gets the worldwide signals (Qloo, Ticketmaster, Open-Meteo); Melbourne alone has
 * Busk Map's own city data: the council's busking layers (adapters/pitches), the curated public spots and the usual
 * hotspots (data/spots.ts). Other cities get empty providers here, and `cityLevels` says so for the UI.
 *
 * Other cities' pitches come from OpenStreetMap (adapters/osm, V2 2.3). Seams for the next items: `rulesFor` is the rules wording a
 * city without council data shows (2.4), `cityLevels` drives the per-signal labels (2.2).
 */
export type { City, CityLevels } from "@/lib/city";
export { MELBOURNE } from "@/lib/city";

/** A city's slug (lib/city.ts). */
export type CityId = string;

/** Cities with Busk Map's own data. The fans map names these (research/fans-map.ts). */
export const KNOWN_CITIES: readonly City[] = [MELBOURNE];

/** The city a validated plan request is for. */
export function cityOf(request: { city?: string; place?: CityPlace }): City {
  const city = cityOfRequest(request);
  if (!city) throw new Error(`No place for city "${request.city}"`);
  return city;
}

export { cityLevels, isMelbourne };

export type Hotspot = LatLon & { name: string; radiusM?: number };

/** Melbourne's curated walkable spots pitches snap to; none for other cities, whose spots come from OpenStreetMap (adapters/osm, PlanContext.spots). */
export function pitchesFor(city: Pick<City, "id">): PublicSpot[] {
  return isMelbourne(city) ? PUBLIC_SPOTS : [];
}

/** Well-known busking hotspots. Melbourne only. */
export function hotspotsFor(city: Pick<City, "id">): Hotspot[] {
  return isMelbourne(city) ? USUAL_HOTSPOTS : [];
}

export type CityRules = {
  level: CityLevels["rules"];
  /** The council's busking page, for "Read the rules". */
  url: string | null;
  /** The rules line on a pitch that isn't a council site. */
  general: string;
};

export const MELBOURNE_RULES_URL = "https://www.melbourne.vic.gov.au/busking";

/** What Busk Map knows of a city's busking rules. Only Melbourne's council publishes them machine-readably. */
export function rulesFor(city: Pick<City, "id">): CityRules {
  return isMelbourne(city)
    ? { level: "local", url: MELBOURNE_RULES_URL, general: "General busking permit: most CBD footpaths and public spaces, subject to clearances." }
    : { level: "none", url: null, general: "Local busking rules not checked: check with the city before you play." };
}

/** Countries where Spotify has no market: a catalogue lookup there would be refused, so it uses the default market. */
const NO_SPOTIFY_MARKET = new Set(["CN", "RU", "BY", "IR", "KP", "SY", "CU", "AF", "MM"]);

/** The Spotify market for song lookups in a city: its country, or Melbourne's where Spotify has none. */
export function spotifyMarket(city: Pick<City, "countryCode">): string {
  return NO_SPOTIFY_MARKET.has(city.countryCode) ? MELBOURNE.countryCode : city.countryCode;
}

/** A built-in city by slug (the Repertoire's and the week planner's city): Melbourne for anything else. */
export function knownCity(id: string): City {
  return KNOWN_CITIES.find((c) => c.id === id) ?? MELBOURNE;
}
