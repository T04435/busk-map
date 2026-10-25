/**
 * The city a busk is planned in (V2 plan item 2.1, "Any city"). Client-safe: the busk form, the plan URL and the server
 * all share it.
 *
 * Melbourne is built in and is the default: a request that names no city, or `city: "melbourne"` with no `place`, is a
 * Melbourne plan exactly as before (same request hash, same short links). Any other city comes from a geocoder lookup
 * (Open-Meteo, /api/cities) and travels in the request as `city: <slug>` plus `place: {…}` (lib/plan-schema.ts), so the
 * server never has to look it up again.
 */
import { z } from "zod";
import { distanceM, type BBox, type LatLon } from "./geo";

export const DEFAULT_CITY_ID = "melbourne";

/** Where a city's record came from: built in (Melbourne), or a geocoder lookup. */
export type CitySource = "builtin" | "open-meteo";

export type City = {
  /** Slug: "melbourne" for the built-in city, else name[-region]-cc ("tokyo-jp", "melbourne-florida-us"). */
  id: string;
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2, upper case. */
  countryCode: string;
  center: LatLon;
  /** IANA time zone: every slot hour is in this zone. */
  timeZone: string;
  /** The planning area: Qloo heatmaps, the local crowd and the agent's searches stay inside it. */
  bbox: BBox;
  /** Search radius around the centre for events and busy places (km). */
  radiusKm: number;
  source: CitySource;
};

export const MELBOURNE: City = {
  id: DEFAULT_CITY_ID,
  name: "Melbourne",
  country: "Australia",
  countryCode: "AU",
  center: { lat: -37.8136, lon: 144.9631 },
  timeZone: "Australia/Melbourne",
  // Melbourne CBD, Southbank and Docklands.
  bbox: { south: -37.8265, west: 144.9365, north: -37.7985, east: 144.9845 },
  radiusKm: 3,
  source: "builtin",
};

/** Half-size of a geocoded city's planning area: about Melbourne's (3 km by 4 km), centred on the geocoder's point. */
export const PLANNING_HALF_HEIGHT_KM = 1.6;
export const PLANNING_HALF_WIDTH_KM = 2.1;
export const DEFAULT_RADIUS_KM = 3;

/** A city slug: lower-case words joined by hyphens. */
export const citySlugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Whether the runtime knows an IANA zone (an unknown one would make every slot hour wrong). */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const label = (max: number) => z.string().trim().min(1).max(max);

/** A geocoded city as a request carries it (`place`): enough to plan there with no second lookup. */
export const cityPlaceSchema = z.object({
  name: label(80),
  country: label(80),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timeZone: z.string().max(64).refine(isTimeZone, "Unknown time zone"),
});

export type CityPlace = z.infer<typeof cityPlaceSchema>;

/** A geocoder hit as /api/cities returns it: the place plus its slug and a region line for telling namesakes apart. */
export type CityOption = CityPlace & { id: string; region: string | null };

const KM_PER_DEG_LAT = 111.32;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** A planning box around a point, `halfH` km north and south, `halfW` km east and west. */
export function boxAround(center: LatLon, halfH = PLANNING_HALF_HEIGHT_KM, halfW = PLANNING_HALF_WIDTH_KM): BBox {
  const dLat = halfH / KM_PER_DEG_LAT;
  const dLon = halfW / (KM_PER_DEG_LAT * Math.max(0.05, Math.cos((center.lat * Math.PI) / 180)));
  return { south: r4(center.lat - dLat), west: r4(center.lon - dLon), north: r4(center.lat + dLat), east: r4(center.lon + dLon) };
}

function slugPart(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** How far from Melbourne's centre a geocoder hit in Australia still counts as Melbourne (the built-in city). */
export const MELBOURNE_MATCH_KM = 30;

/** Whether a geocoded point is the built-in Melbourne (not Melbourne, Florida). */
export function isMelbournePlace(place: Pick<CityPlace, "countryCode" | "lat" | "lon">): boolean {
  return place.countryCode === MELBOURNE.countryCode && distanceM(place, MELBOURNE.center) <= MELBOURNE_MATCH_KM * 1000;
}

/**
 * The slug for a geocoded city: name, then the region when it differs from the name, then the country code
 * ("tokyo-jp", "melbourne-florida-us"). Melbourne, Victoria is always "melbourne". A name with no Latin letters falls back
 * to its rounded coordinates, so the slug stays stable for the same place.
 */
export function citySlug(place: Pick<CityPlace, "name" | "countryCode" | "lat" | "lon">, region: string | null = null): string {
  if (isMelbournePlace(place)) return DEFAULT_CITY_ID;
  const name = slugPart(place.name);
  const area = region ? slugPart(region) : "";
  const coord = (n: number, pos: string, neg: string) => `${Math.abs(Math.round(n * 100))}${n < 0 ? neg : pos}`;
  const parts = [name || `at-${coord(place.lat, "n", "s")}-${coord(place.lon, "e", "w")}`, area && area !== name ? area : "", place.countryCode.toLowerCase()];
  return parts
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** A geocoded place as a City. */
export function cityFromPlace(id: string, place: CityPlace): City {
  const center = { lat: r4(place.lat), lon: r4(place.lon) };
  return {
    id,
    name: place.name,
    country: place.country,
    countryCode: place.countryCode,
    center,
    timeZone: place.timeZone,
    bbox: boxAround(center),
    radiusKm: DEFAULT_RADIUS_KM,
    source: "open-meteo",
  };
}

/** The place a City stands for, as a request carries it. */
export function placeOf(city: City): CityPlace {
  return { name: city.name, country: city.country, countryCode: city.countryCode, lat: city.center.lat, lon: city.center.lon, timeZone: city.timeZone };
}

export const isMelbourne = (city: Pick<City, "id">) => city.id === DEFAULT_CITY_ID;

/**
 * The city a request is for. Melbourne when it says "melbourne" (or nothing), else its `place`. Null for a non-Melbourne
 * slug without a place (the request schema refuses those).
 */
export function cityOfRequest(request: { city?: string; place?: CityPlace }): City | null {
  const id = request.city ?? DEFAULT_CITY_ID;
  if (id === DEFAULT_CITY_ID) return MELBOURNE;
  return request.place ? cityFromPlace(id, request.place) : null;
}

/** The request fields for a city: nothing extra for Melbourne (old hashes stay), slug and place for any other. */
export function requestCityFields(city: City): { city: string; place?: CityPlace } {
  return isMelbourne(city) ? { city: DEFAULT_CITY_ID } : { city: city.id, place: placeOf(city) };
}

/** The busk form's starting choice. */
export const MELBOURNE_OPTION: CityOption = { id: DEFAULT_CITY_ID, ...placeOf(MELBOURNE), region: "Victoria" };

/** "Tokyo, Japan" / "Melbourne, Florida, United States". */
export function cityLabel(option: Pick<CityOption, "name" | "country" | "region">): string {
  return [option.name, option.region && option.region !== option.name ? option.region : null, option.country].filter(Boolean).join(", ");
}

/**
 * How much each signal knows about a city, for the plan's per-signal labels (V2 2.2) and the rules wording (2.4):
 * - `local`: Busk Map's own city data (Melbourne's council busking layers, its curated public spots and hotspots).
 * - `global`: a worldwide provider (Qloo taste and activity, Ticketmaster events, Open-Meteo weather); coverage varies by city.
 * - `none`: nothing for this city yet; the plan goes without it.
 */
export const signalLevelSchema = z.enum(["local", "global", "none"]);
export type SignalLevel = z.infer<typeof signalLevelSchema>;

export const cityLevelsSchema = z.object({
  taste: signalLevelSchema,
  activity: signalLevelSchema,
  events: signalLevelSchema,
  weather: signalLevelSchema,
  /** The council's busking rules (sites, no-busking and unamplified lines). `none`: rules not checked. */
  rules: signalLevelSchema,
  /** Walkable public spots a pitch is snapped to. `none`: pitches sit at Qloo's strongest taste cells. */
  pitches: signalLevelSchema,
  /** Well-known busking hotspots ("usual spot", the usual crowd). */
  hotspots: signalLevelSchema,
});
export type CityLevels = z.infer<typeof cityLevelsSchema>;

/** The levels for a city: Melbourne has its own rules, spots and hotspots; every city has the worldwide signals. */
export function cityLevels(city: Pick<City, "id">): CityLevels {
  const local: SignalLevel = isMelbourne(city) ? "local" : "none";
  return { taste: "global", activity: "global", events: "global", weather: "global", rules: local, pitches: local, hotspots: local };
}
