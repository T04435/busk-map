/**
 * "Where your fans are" (hackathons/qloo-2026/repertoire-fans-map-spec.md, U24): the pure parts, client-safe. Which city the map
 * opens on, the city list for its picker, the "Plan a busk here" link and the props shape BRAND's FansMap takes.
 */
import { inBBox } from "./geo";
import type { FansMapCell, FansMapCity, FansMapOutput } from "./repertoire-research";
import { CITIES, CITY_IDS, type CityId } from "@/server/cities";

/** The cities the map's picker offers: the same ones the busk form offers (the planner's CITIES). */
export const FANS_MAP_CITIES: { id: CityId; name: string }[] = CITY_IDS.map((id) => ({ id, name: CITIES[id].name }));
/** The busk form's default city: used when the Repertoire has no pitches and no city of its own. */
export const DEFAULT_FANS_MAP_CITY: CityId = "melbourne";

export const isCityId = (id: unknown): id is CityId => typeof id === "string" && (CITY_IDS as readonly string[]).includes(id);

/** The map view of a city: centre as [lng, lat] and a zoom that fits the planning area. */
export function fansMapCity(id: CityId): FansMapCity {
  const c = CITIES[id];
  const spanLon = Math.max(0.005, c.bbox.east - c.bbox.west);
  // Web-mercator zoom whose 512 px world fits the area's longitude span in about 640 px.
  const zoom = Math.max(9, Math.min(15, Math.round(Math.log2((360 * 640) / (512 * spanLon)) * 10) / 10));
  return { id: c.id, name: c.name, center: [c.center.lon, c.center.lat], zoom };
}

/** The city whose planning area holds a point, if any. */
export function cityOfPoint(point: { lat: number; lon: number }): CityId | null {
  return CITY_IDS.find((id) => inBBox(point, CITIES[id].bbox)) ?? null;
}

/**
 * The city the map opens on, in this order: the city of the Repertoire's usual pitches (the first one inside a supported city,
 * newest first), else of its last busk, else the Repertoire's own city field, else the busk form's default.
 */
export function resolveFansMapCity(playlist: {
  usualPitches?: readonly { lat: number; lon: number }[];
  recentBusks?: readonly { lat: number; lon: number }[];
  city?: string | null;
}): CityId {
  for (const list of [playlist.usualPitches, playlist.recentBusks]) {
    for (const p of list ?? []) {
      const id = cityOfPoint(p);
      if (id) return id;
    }
  }
  return isCityId(playlist.city) ? playlist.city : DEFAULT_FANS_MAP_CITY;
}

/** "Plan a busk here": the busk form with this city prefilled. */
export const planBuskHref = (cityId: string) => `/busks?city=${encodeURIComponent(cityId)}`;

/** What BRAND's FansMap takes (null `cells` while loading, [] when Qloo has no data). */
export type FansMapProps = {
  city: FansMapCity;
  cities: { id: string; name: string }[];
  cells: FansMapCell[] | null;
  topAreas: string[];
  planHref: string;
  busy?: boolean;
};

/** The step's output as FansMap props; the page supplies `busy` and `onCityChange`. */
export function fansMapProps(out: FansMapOutput, busy = false): FansMapProps {
  return { city: out.city, cities: FANS_MAP_CITIES, cells: out.cells, topAreas: out.areas.slice(0, 3), planHref: planBuskHref(out.city.id), busy };
}

/** The Hive's line: "Your crowd is strongest around A, B and C". */
export function fansMapSummary(areas: string[], cityName: string): string {
  if (areas.length === 0) return `Qloo found no clear pocket of your crowd in ${cityName}`;
  const list = areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`;
  return `Your crowd is strongest around ${list}`;
}
