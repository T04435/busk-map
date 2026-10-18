/**
 * "Where your fans are" (hackathons/qloo-2026/repertoire-fans-map-spec.md, U24; global since U30, the user's call of 19 Oct): the pure
 * parts, client-safe. The world area the heatmap is asked for, the "Plan a busk" link and the props shape BRAND's FansMap takes.
 */
import type { BBox } from "./geo";
import type { FansMapCell, FansMapOutput } from "./repertoire-research";

/** The whole world, as the heatmap's polygon (latitudes stop short of the poles, where web-mercator maps end). */
export const WORLD_BBOX: BBox = { south: -85, west: -180, north: 85, east: 180 };

/** "Plan a busk": the busk form, with this city prefilled when Busk Map covers the top place. */
export const planBuskHref = (cityId?: string | null) => (cityId ? `/busks?city=${encodeURIComponent(cityId)}` : "/busks");

/** What BRAND's FansMap takes (null `cells` while loading, [] when Qloo has no data). */
export type FansMapProps = { cells: FansMapCell[] | null; topAreas: string[]; planHref: string };

/** The step's output as FansMap props. */
export function fansMapProps(out: FansMapOutput): FansMapProps {
  return { cells: out.cells, topAreas: out.areas.slice(0, 3), planHref: planBuskHref(out.planCity) };
}

/** The Hive's line: "Your crowd is strongest in A, B and C". */
export function fansMapSummary(areas: string[]): string {
  if (areas.length === 0) return "Qloo found no clear pocket of your crowd";
  const list = areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`;
  return `Your crowd is strongest in ${list}`;
}
