/**
 * "Where your fans are" (hackathons/qloo-2026/repertoire-fans-map-spec.md, U24; global since U30, the user's call of 19 Oct): the pure
 * parts, client-safe. The world area the heatmap is asked for, the props shape BRAND's FansMap takes.
 */
import type { BBox } from "./geo";
import type { FansMapCell, FansMapCity, FansMapOutput } from "./repertoire-research";

/** The whole world, as the heatmap's polygon (latitudes stop short of the poles, where web-mercator maps end). */
export const WORLD_BBOX: BBox = { south: -85, west: -180, north: 85, east: 180 };

/** What BRAND's FansMap takes (null `cells` while loading, [] when Qloo has no data). */
export type FansMapProps = { cells: FansMapCell[] | null; cities?: FansMapCity[] };

/** The step's output as FansMap props. */
export function fansMapProps(out: FansMapOutput): FansMapProps {
  const cities = topCities(out);
  return { cells: out.cells, ...(cities.length ? { cities } : {}) };
}

/** The Hive's line: "Your crowd is strongest in A, B and C". */
export function fansMapSummary(areas: string[]): string {
  if (areas.length === 0) return "Qloo found no clear pocket of your crowd";
  const list = areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`;
  return `Your crowd is strongest in ${list}`;
}

/** How many cities the step names and the map marks. */
export const FANS_MAP_TOP_CITIES = 3;

/**
 * The cities the map marks: the same top cities the step's line names ("Your crowd is strongest in A, B and C"), strongest first.
 * Research saved before this showed up to eight markers while the line named three, so the list is cut to the line's cities.
 */
export function topCities(out: Pick<FansMapOutput, "cities" | "areas">): FansMapCity[] {
  const cities = out.cities ?? [];
  const named = new Set(out.areas);
  const inLine = cities.filter((c) => named.has(c.name));
  return (inLine.length > 0 ? inLine : cities).slice(0, FANS_MAP_TOP_CITIES);
}

/** "Medellin, Cali and Bogota". */
export function cityList(cities: readonly { name: string }[]): string {
  const names = cities.map((c) => c.name);
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
