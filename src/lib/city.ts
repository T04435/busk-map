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
/** A place with no size on record (old links, small towns): Melbourne's CBD-sized area. */
export const DEFAULT_RADIUS_KM = 3;
/** The planning radii a place may get, by its size (radiusForPlace). */
export const PLANNING_RADII_KM = [3, 6, 10, 15] as const;
export const MAX_RADIUS_KM = 15;

/**
 * How far around a geocoded place the plan looks (km), from the geocoder's population and GeoNames feature code: a metro
 * covers the city and its suburbs, a town its centre. A capital (PPLC) gets at least 10 km and a region's seat (PPLA) at
 * least 6 km, since GeoNames counts only the city proper. A section of a city (PPLX, a neighbourhood) stays at 3 km.
 */
export function radiusForPlace(place: { population?: number | null; featureCode?: string | null }): number {
  const pop = place.population ?? 0;
  const code = place.featureCode ?? "";
  if (code === "PPLX") return DEFAULT_RADIUS_KM;
  const byPop = pop >= 1_000_000 ? 15 : pop >= 250_000 ? 10 : pop >= 50_000 ? 6 : DEFAULT_RADIUS_KM;
  const floor = code === "PPLC" ? 10 : code === "PPLA" ? 6 : DEFAULT_RADIUS_KM;
  return Math.max(byPop, floor);
}

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
  /**
   * The planning radius (km, radiusForPlace). OPTIONAL and never defaulted: a place without it (links and stored requests from
   * before metro areas) plans the CBD-sized area it always did, with the same request hash.
   */
  radiusKm: z.number().int().min(1).max(MAX_RADIUS_KM).optional(),
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

/** Whether a city plans a metro area in districts (a radius past the CBD-sized default). Never Melbourne. */
export const isMetro = (city: Pick<City, "radiusKm" | "source">) => city.source !== "builtin" && city.radiusKm > DEFAULT_RADIUS_KM;

/**
 * A geocoded place as a City. With no radius (or the default one) the planning area is the CBD-sized box it always was; a
 * larger radius makes it a square reaching `radiusKm` from the centre each way (the city and its suburbs).
 */
export function cityFromPlace(id: string, place: CityPlace): City {
  const center = { lat: r4(place.lat), lon: r4(place.lon) };
  const radiusKm = place.radiusKm ?? DEFAULT_RADIUS_KM;
  return {
    id,
    name: place.name,
    country: place.country,
    countryCode: place.countryCode,
    center,
    timeZone: place.timeZone,
    bbox: radiusKm > DEFAULT_RADIUS_KM ? boxAround(center, radiusKm, radiusKm) : boxAround(center),
    radiusKm,
    source: "open-meteo",
  };
}

/** The place a City stands for, as a request carries it. The radius only when it isn't the default (old hashes stay). */
export function placeOf(city: City): CityPlace {
  const place = { name: city.name, country: city.country, countryCode: city.countryCode, lat: city.center.lat, lon: city.center.lon, timeZone: city.timeZone };
  return city.source !== "builtin" && city.radiusKm !== DEFAULT_RADIUS_KM ? { ...place, radiusKm: city.radiusKm } : place;
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

/**
 * A place in a plan URL: `place=Tokyo~JP~35.6895~139.6917~Asia/Tokyo~Japan` beside `city=tokyo-jp`, then the planning radius
 * when the place has one (`~15`). Melbourne links carry neither, as before.
 */
export function placeParam(place: CityPlace): string {
  const clean = (s: string) => s.replace(/~/g, " ");
  const parts: (string | number)[] = [clean(place.name), place.countryCode, place.lat, place.lon, place.timeZone, clean(place.country)];
  if (place.radiusKm !== undefined) parts.push(place.radiusKm);
  return parts.join("~");
}

/**
 * The place in a plan URL, or undefined when absent or unreadable (the request schema then refuses a non-Melbourne city).
 * A link from before metro areas has no radius: it plans the CBD-sized area it always did.
 */
export function parsePlaceParam(value: string | undefined): CityPlace | undefined {
  if (!value) return undefined;
  const [name, countryCode, lat, lon, timeZone, country, radius] = value.split("~");
  const radiusKm = radius === undefined || radius === "" ? undefined : Number(radius);
  const parsed = cityPlaceSchema.safeParse({ name, countryCode, lat: Number(lat), lon: Number(lon), timeZone, country, ...(radiusKm === undefined ? {} : { radiusKm }) });
  return parsed.success ? parsed.data : undefined;
}

/** The busk form's option for a request's city (planning again). */
export function optionOf(request: { city?: string; place?: CityPlace }): CityOption {
  const city = cityOfRequest(request);
  return !city || isMelbourne(city) ? MELBOURNE_OPTION : { id: city.id, ...placeOf(city), region: null };
}

/** The request fields for a picked city: nothing extra for Melbourne, slug and place for any other. */
export function requestFieldsOf(option: CityOption): { city: string; place?: CityPlace } {
  if (option.id === DEFAULT_CITY_ID) return { city: DEFAULT_CITY_ID };
  const { name, country, countryCode, lat, lon, timeZone, radiusKm } = option;
  return { city: option.id, place: { name, country, countryCode, lat, lon, timeZone, ...(radiusKm !== undefined ? { radiusKm } : {}) } };
}

/**
 * A fans city in a /busks link: `fans=Bogota~4.711~-74.0721` (name, then the map marker's latitude and longitude). The page
 * resolves it to a City through the geocoder; the marker's point tells the Bogota in Colombia from any other.
 */
export function fansCityParam(city: { name: string; lat: number; lng: number }): string {
  return [city.name.replace(/~/g, " "), city.lat, city.lng].join("~");
}

/** The fans city in a /busks link, or undefined when absent or unreadable. */
export function parseFansCityParam(value: string | undefined): { name: string; lat: number; lon: number } | undefined {
  if (!value) return undefined;
  const [name, lat, lon] = value.split("~");
  const point = z.object({ name: label(80), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).safeParse({ name, lat: lat === undefined || lat === "" ? NaN : Number(lat), lon: lon === undefined || lon === "" ? NaN : Number(lon) });
  return point.success ? point.data : undefined;
}

/** How far from a fans marker a geocoded city may be and still be that city (km). */
export const FANS_CITY_MATCH_KM = 100;

/** The geocoder's option nearest to a point, within FANS_CITY_MATCH_KM, or null. Melbourne, Victoria resolves to the built-in Melbourne. */
export function nearestCityOption(options: CityOption[], point: LatLon): CityOption | null {
  let best: { option: CityOption; m: number } | null = null;
  for (const option of options) {
    const m = distanceM(option, point);
    if (!best || m < best.m) best = { option, m };
  }
  if (!best || best.m > FANS_CITY_MATCH_KM * 1000) return null;
  return best.option.id === DEFAULT_CITY_ID ? MELBOURNE_OPTION : best.option;
}

/** The name a geocoder is asked for: a label like "Havana, Cuba" is searched as "Havana". */
export const fansCityQuery = (name: string): string => name.split(",")[0].trim();
