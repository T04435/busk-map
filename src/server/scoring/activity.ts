import { distanceM, type LatLon } from "@/lib/geo";
import { NEUTRAL_ACTIVITY, wordLevel, type ActivityBasis } from "@/lib/activity";
import { FINE_TASTE_RADIUS_M, TASTE_RADIUS_M, isFineHeatmap } from "./heatmap";
import { openDuring } from "./hours";
import type { HeatCellInput, PlaceInput } from "./types";

/**
 * The activity estimate: how busy a pitch is likely to be in a time slot, from Qloo alone (no head counts, no sensors).
 * Two parts, both read from data the plan already has:
 *  - area: the heatmap's popularity near the pitch, where activity concentrates in the city (the same in every hour);
 *  - venues: popular Qloo places near the pitch that are OPEN in the hour (this is the only part that varies by hour of day,
 *    from each venue's opening hours), weighted by popularity and by distance, then saturated.
 * level = ACTIVITY_AREA_SHARE · area + ACTIVITY_VENUE_SHARE · venues, 0–1, relative (it ranks pitches and hours; it is not a count).
 * With only one part available the level is that part alone; with neither it is NEUTRAL_ACTIVITY with basis "none", which the
 * scoring treats as unknown (the factor drops out) and the UI labels as "no estimate". Pure: no I/O, no clock.
 */

/** Share of the level from the heatmap's popularity near the pitch... */
export const ACTIVITY_AREA_SHARE = 0.4;
/** ...and from the popular places open in the hour. */
export const ACTIVITY_VENUE_SHARE = 0.6;
/** Places within this distance of the pitch count, fading linearly to zero at the edge. */
export const ACTIVITY_PLACES_RADIUS_M = 250;
/** Saturation constant for summed place popularity (diminishing returns). */
export const ACTIVITY_PLACES_SATURATION = 1.5;
/** A place with no popularity from Qloo counts as average. */
export const UNKNOWN_POPULARITY = 0.5;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type NearbyPlace = PlaceInput & { distanceM: number; open: "open" | "unknown" };

export type ActivityData = { cells: HeatCellInput[]; places: PlaceInput[]; weekday: string };

export type ActivityHour = { hour: number; level: number };

export type Activity = {
  /** 0–1, relative. NEUTRAL_ACTIVITY when basis is "none". */
  level: number;
  basis: ActivityBasis;
  /** Heatmap popularity near the pitch (0–1), or null when the heatmap has none there. */
  area: number | null;
  /** Popular places open in the slot, saturated (0–1), or null when Qloo sent no places at all. */
  venues: number | null;
  /** Places open (or of unknown hours) in the slot near the pitch, strongest contribution first. */
  nearby: NearbyPlace[];
  /** The level hour by hour across the slot. */
  curve: ActivityHour[];
};

/**
 * The heatmap's popularity near a point: inverse-square-distance weighted over cells within the taste radius (so the cell a
 * pitch sits in dominates). Null when no cell with a popularity is in range.
 */
export function areaPopularity(point: LatLon, cells: HeatCellInput[]): number | null {
  const radius = isFineHeatmap(cells) ? FINE_TASTE_RADIUS_M : TASTE_RADIUS_M;
  let weighted = 0;
  let total = 0;
  for (const cell of cells) {
    if (typeof cell.popularity !== "number") continue;
    const d = distanceM(point, cell);
    if (d > radius) continue;
    const w = 1 / Math.max(d, 100) ** 2;
    weighted += w * clamp01(cell.popularity);
    total += w;
  }
  return total === 0 ? null : clamp01(weighted / total);
}

type Near = { place: PlaceInput; d: number };

function placesNear(point: LatLon, places: PlaceInput[]): Near[] {
  const out: Near[] = [];
  for (const place of places) {
    const d = distanceM(point, place);
    if (d <= ACTIVITY_PLACES_RADIUS_M) out.push({ place, d });
  }
  return out;
}

/** The venue part for hours [from, to): popularity × distance decay of the places not known closed, saturated. */
function venuesIn(near: Near[], weekday: string, from: number, to: number): { value: number; open: { near: Near; weight: number; state: "open" | "unknown" }[] } {
  const open: { near: Near; weight: number; state: "open" | "unknown" }[] = [];
  for (const n of near) {
    const state = openDuring(n.place.hours, weekday, from, to);
    if (state === "closed") continue;
    open.push({ near: n, weight: (n.place.popularity ?? UNKNOWN_POPULARITY) * (1 - n.d / ACTIVITY_PLACES_RADIUS_M), state });
  }
  const sum = open.reduce((total, o) => total + o.weight, 0);
  return { value: clamp01(1 - Math.exp(-sum / ACTIVITY_PLACES_SATURATION)), open };
}

function combineParts(area: number | null, venues: number | null): { level: number; basis: ActivityBasis } {
  if (area !== null && venues !== null) return { level: clamp01(ACTIVITY_AREA_SHARE * area + ACTIVITY_VENUE_SHARE * venues), basis: "heatmap+places" };
  if (venues !== null) return { level: venues, basis: "places" };
  if (area !== null) return { level: area, basis: "heatmap" };
  return { level: NEUTRAL_ACTIVITY, basis: "none" };
}

const hoursOf = (startHour: number, endHour: number) => Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);

/**
 * The hourly curve of the estimate: the level for each hour in [fromHour, toHour) on the weekday. Only the venues' opening hours
 * move it from hour to hour, so with no places (or no hours) it is flat.
 */
export function activityCurve(point: LatLon, data: ActivityData, fromHour: number, toHour: number): ActivityHour[] {
  const area = areaPopularity(point, data.cells);
  const near = placesNear(point, data.places);
  const hasPlaces = data.places.length > 0;
  return hoursOf(fromHour, toHour).map((hour) => ({
    hour,
    level: combineParts(area, hasPlaces ? venuesIn(near, data.weekday, hour, hour + 1).value : null).level,
  }));
}

/**
 * The estimate for a slot [startHour, endHour): the mean of its hourly levels, so a slot where the busy venues close halfway
 * scores between an open slot and a closed one. Any-time windows are this same call, one per window.
 */
export function activityEstimate(point: LatLon, data: ActivityData, startHour: number, endHour: number): Activity {
  const area = areaPopularity(point, data.cells);
  const near = placesNear(point, data.places);
  const hasPlaces = data.places.length > 0;
  const hours = hoursOf(startHour, endHour);
  const perHour = hours.map((hour) => (hasPlaces ? venuesIn(near, data.weekday, hour, hour + 1).value : null));
  const venues = hasPlaces ? perHour.reduce<number>((total, v) => total + (v ?? 0), 0) / hours.length : null;
  const { level, basis } = combineParts(area, venues);
  const whole = hasPlaces ? venuesIn(near, data.weekday, startHour, Math.max(endHour, startHour + 1)).open : [];
  return {
    level,
    basis,
    area,
    venues,
    nearby: [...whole].sort((a, b) => b.weight - a.weight).map((o) => ({ ...o.near.place, distanceM: Math.round(o.near.d), open: o.state })),
    curve: hours.map((hour, i) => ({ hour, level: combineParts(area, perHour[i]).level })),
  };
}

/**
 * How much of the city's popular-place activity is open each hour of a weekday: the summed popularity of the Qloo places not
 * known closed in that hour. Relative only (a day is compared with the other days of the week); empty when Qloo sent no places.
 */
export function placesOpenByHour(places: PlaceInput[], weekday: string, fromHour: number, toHour: number): ActivityHour[] {
  if (places.length === 0) return [];
  return hoursOf(fromHour, toHour).map((hour) => ({
    hour,
    level: places.reduce((total, p) => (openDuring(p.hours, weekday, hour, hour + 1) === "closed" ? total : total + (p.popularity ?? UNKNOWN_POPULARITY)), 0),
  }));
}

/**
 * The level the words (Quiet to Very busy, fixed bands in lib/activity) are read from. Live Qloo is not calibrated, so the
 * level is compared with every pitch scored in the same plan (0 at the least active, 1 at the most active); the word then
 * takes the LOWER of that and the absolute level (`wordLevel`). A pitch reads "Very busy" only when it is among the busiest of
 * the pool and its own level is high, so a narrow pool does not make its top three all "Very busy". Null with fewer than
 * three levels or no spread, where the absolute level is used instead.
 */
export function relativeActivity(level: number, levels: number[]): number | null {
  if (levels.length < 3) return null;
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return max - min < 0.05 ? null : wordLevel(level, Math.min(1, Math.max(0, (level - min) / (max - min))));
}
