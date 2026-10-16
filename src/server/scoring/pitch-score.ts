import { distanceM, type LatLon } from "@/lib/geo";
import { openDuring } from "./hours";
import type {
  Candidate,
  Discovery,
  EventInput,
  FactorName,
  Factors,
  FootfallSource,
  HeatCellInput,
  PlaceInput,
  SensorInput,
  WeatherHourInput,
  Weights,
} from "./types";

// ---- Radii and constants (documented in the UI's "how we score") ----------

/** Cells within this distance inform a pitch's taste (geohash-6 cells are about 600 × 1,000 m). */
export const TASTE_RADIUS_M = 900;
/**
 * Live Qloo heatmaps over the city centre come back at geohash precision 7
 * (cells about 150 m across), so taste is read over a tighter radius: street
 * level rather than neighbourhood level.
 */
export const FINE_TASTE_RADIUS_M = 300;
/** Geohash length from which a heatmap counts as fine-grained. */
export const FINE_GEOHASH_PRECISION = 7;

/** True when the heatmap's cells are fine-grained (geohash precision 7 or more). */
export function isFineHeatmap(cells: { geohash?: string | null }[]): boolean {
  const lengths = cells.flatMap((c) => (c.geohash ? [c.geohash.length] : [])).sort((a, b) => a - b);
  return lengths.length > 0 && lengths[Math.floor(lengths.length / 2)] >= FINE_GEOHASH_PRECISION;
}
export const FOOTFALL_RADIUS_M = 250;
/** Sensors within this distance give an estimate when none is close enough to measure the pitch. */
export const FOOTFALL_ESTIMATE_RADIUS_M = 600;
/** Estimates count for a little less than a sensor at the pitch. */
export const FOOTFALL_ESTIMATE_DISCOUNT = 0.9;
export const FOOTFALL_PROXY_DISCOUNT = 0.8;
/** A pitch off the usual circuit with at least this taste fit is a hidden gem. */
export const HIDDEN_GEM_MIN_TASTE = 0.6;
/**
 * At a well-known hotspot the crowd is shared with the other buskers who go
 * there: its foot traffic counts for this share.
 */
export const USUAL_SPOT_FOOTFALL_SHARE = 0.85;
/** ...and earns the discovery bonus from this fit up. */
export const DISCOVERY_BONUS_MIN_TASTE = 0.75;
export const PLACES_RADIUS_M = 250;
export const EVENTS_RADIUS_M = 800;
/** Crowds arrive in the hour before an event and leave within 45 minutes of the end. */
export const EVENT_ARRIVAL_MS = 60 * 60_000;
export const EVENT_EXIT_MS = 45 * 60_000;
/** Saturation constant for summed place popularity. */
export const PLACES_SATURATION = 1.5;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Taste affinity near a point, scaled between the city's median cell (0) and
 * its best cell (1), so the performer's strong areas stand apart: Qloo's
 * heatmap affinity is percentile-like, which on its own barely separates the
 * top cells. Inverse-square-distance weighted over cells within the radius,
 * so the cell a pitch sits in dominates; null when there are no cells.
 */
export function tasteFactor(point: LatLon, cells: HeatCellInput[]): number | null {
  if (cells.length === 0) return null;
  const sorted = cells.map((c) => c.affinity).sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];
  const floor = cells.length >= 4 ? sorted[Math.floor(sorted.length / 2)] : 0;
  if (max <= floor) return max > 0 ? 1 : 0;
  const radius = isFineHeatmap(cells) ? FINE_TASTE_RADIUS_M : TASTE_RADIUS_M;
  let weighted = 0;
  let total = 0;
  for (const cell of cells) {
    const d = distanceM(point, cell);
    if (d > radius) continue;
    const w = 1 / Math.max(d, 100) ** 2;
    weighted += w * cell.affinity;
    total += w;
  }
  return total === 0 ? 0 : clamp01((weighted / total - floor) / (max - floor));
}

/**
 * Foot traffic for the slot, on a square-root scale (diminishing returns, but a
 * quiet slot still scores clearly lower) relative to the busiest sensor in
 * the slot, or to `reference` when slots must be comparable (the week planner
 * passes the week's busiest). In order of preference:
 * - "sensor": the nearest sensor within FOOTFALL_RADIUS_M;
 * - "nearby-sensors": an inverse-distance estimate from sensors within
 *   FOOTFALL_ESTIMATE_RADIUS_M, discounted;
 * - "qloo-popularity": the Qloo heatmap's popularity for the nearest cell,
 *   discounted (the global baseline in spec.md);
 * - null when there is nothing (the weight then drops out rather than scoring zero).
 */
export function footfallFactor(
  point: LatLon,
  sensors: SensorInput[],
  reference?: number,
  cells: HeatCellInput[] = [],
): { value: number | null; sensor: SensorInput | null; source: FootfallSource | null; estimatedHourly: number | null } {
  const counted = sensors.filter((s): s is SensorInput & { avgHourly: number } => s.avgHourly !== null);
  const max = reference ?? Math.max(0, ...counted.map((s) => s.avgHourly));
  const scale = (hourly: number) => (max <= 0 ? 0 : clamp01(Math.sqrt(hourly / max)));
  const byDistance = counted.map((sensor) => ({ sensor, d: distanceM(point, sensor) })).sort((a, b) => a.d - b.d);
  const [nearest] = byDistance;
  if (nearest && nearest.d <= FOOTFALL_RADIUS_M) {
    return { value: scale(nearest.sensor.avgHourly), sensor: nearest.sensor, source: "sensor", estimatedHourly: null };
  }
  const around = byDistance.filter((x) => x.d <= FOOTFALL_ESTIMATE_RADIUS_M);
  if (around.length > 0) {
    let weighted = 0;
    let total = 0;
    for (const { sensor, d } of around) {
      weighted += sensor.avgHourly / d;
      total += 1 / d;
    }
    const hourly = weighted / total;
    return { value: scale(hourly) * FOOTFALL_ESTIMATE_DISCOUNT, sensor: around[0].sensor, source: "nearby-sensors", estimatedHourly: Math.round(hourly) };
  }
  const withPopularity = cells.filter((c): c is HeatCellInput & { popularity: number } => typeof c.popularity === "number");
  if (withPopularity.length > 0) {
    const cell = withPopularity.reduce((best, c) => (distanceM(point, c) < distanceM(point, best) ? c : best));
    if (distanceM(point, cell) <= TASTE_RADIUS_M) return { value: clamp01(cell.popularity) * FOOTFALL_PROXY_DISCOUNT, sensor: null, source: "qloo-popularity", estimatedHourly: null };
  }
  return { value: null, sensor: null, source: null, estimatedHourly: null };
}

/** Hidden gem: off the usual circuit with a strong taste fit. Usual spot: at a well-known hotspot. */
export function discoveryOf(candidate: Pick<Candidate, "usualSpot">, taste: number | null): Discovery {
  if (candidate.usualSpot) return "usual";
  return taste !== null && taste >= HIDDEN_GEM_MIN_TASTE ? "hidden-gem" : null;
}

/** The discovery bonus: a hidden gem's taste fit, from DISCOVERY_BONUS_MIN_TASTE up; otherwise 0. */
export function discoveryFactor(discovery: Discovery, taste: number | null): number {
  return discovery === "hidden-gem" && taste !== null && taste >= DISCOVERY_BONUS_MIN_TASTE ? taste : 0;
}

export type NearbyPlace = PlaceInput & { distanceM: number; open: "open" | "unknown" };

/**
 * Popular places open in the slot near the point. Popularity is summed with a
 * linear distance decay, then saturated. Places known to be closed are left out;
 * the nearby list is ordered by contribution.
 */
export function placesFactor(
  point: LatLon,
  places: PlaceInput[],
  weekday: string,
  startHour: number,
  endHour: number,
): { value: number; nearby: NearbyPlace[] } {
  const found: { place: NearbyPlace; weight: number }[] = [];
  for (const place of places) {
    const d = distanceM(point, place);
    if (d > PLACES_RADIUS_M) continue;
    const open = openDuring(place.hours, weekday, startHour, endHour);
    if (open === "closed") continue;
    // Unknown popularity counts as average.
    const weight = (place.popularity ?? 0.5) * (1 - d / PLACES_RADIUS_M);
    found.push({ place: { ...place, distanceM: Math.round(d), open }, weight });
  }
  found.sort((a, b) => b.weight - a.weight);
  const sum = found.reduce((total, f) => total + f.weight, 0);
  return { value: clamp01(1 - Math.exp(-sum / PLACES_SATURATION)), nearby: found.map((f) => f.place) };
}

export type NearbyEvent = EventInput & { distanceM: number; moment: "arriving" | "leaving" };

/**
 * Event crowds passing during the slot: arriving in the hour before the start,
 * or leaving within 45 minutes of the end. Exits count fully, arrivals 70%.
 * When Qloo knows how close the event crowd's taste is to the performer's
 * (its headliner's affinity), the crowd counts in proportion to that match.
 */
export function eventsFactor(
  point: LatLon,
  events: EventInput[],
  slotStartMs: number,
  slotEndMs: number,
): { value: number; nearby: NearbyEvent[] } {
  const nearby: NearbyEvent[] = [];
  let best = 0;
  for (const event of events) {
    const d = distanceM(point, event.venue);
    if (d > EVENTS_RADIUS_M) continue;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    const overlaps = (a: number, b: number) => a < slotEndMs && b > slotStartMs;
    const leaving = overlaps(end, end + EVENT_EXIT_MS);
    const arriving = overlaps(start - EVENT_ARRIVAL_MS, start);
    if (!leaving && !arriving) continue;
    const proximity = 1 - d / EVENTS_RADIUS_M;
    best = Math.max(best, proximity * (leaving ? 1 : 0.7) * (event.tasteMatch ? clamp01(event.tasteMatch.affinity) : 1));
    nearby.push({ ...event, distanceM: Math.round(d), moment: leaving ? "leaving" : "arriving" });
  }
  return { value: clamp01(best), nearby };
}

/**
 * 0–1 penalty from rain chance, strong wind and cold, averaged over the slot.
 * Null when there is no forecast (weather is then ignored, and labelled).
 */
export function weatherPenalty(hours: WeatherHourInput[] | null): number | null {
  if (!hours || hours.length === 0) return null;
  const perHour = hours.map((h) => {
    const rain = (h.precipitationProbability ?? 0) / 100;
    const wind = h.windKmh === null ? 0 : clamp01((h.windKmh - 25) / 25);
    const cold = h.temperatureC === null ? 0 : clamp01((10 - h.temperatureC) / 10);
    return clamp01(0.7 * rain + 0.2 * wind + 0.1 * cold);
  });
  return perHour.reduce((a, b) => a + b, 0) / perHour.length;
}

const FACTORS: FactorName[] = ["taste", "footfall", "places", "events"];

/**
 * Combine factors with weights. Missing factors drop out of the weighted mean;
 * the discovery bonus is added on top and the weather penalty taken off.
 */
export function combine(factors: Factors, weights: Weights): { score: number; contributions: Record<FactorName | "discovery", number | null> } {
  let weighted = 0;
  let total = 0;
  const contributions = {} as Record<FactorName | "discovery", number | null>;
  for (const name of FACTORS) {
    const value = factors[name];
    if (value === null || weights[name] === 0) {
      contributions[name] = null;
      continue;
    }
    weighted += weights[name] * value;
    total += weights[name];
    contributions[name] = weights[name] * value;
  }
  const base = total === 0 ? 0 : weighted / total;
  const bonus = weights.discovery * factors.discovery;
  contributions.discovery = bonus > 0 ? bonus : null;
  const penalty = factors.weatherPenalty === null ? 0 : weights.weather * factors.weatherPenalty;
  return { score: clamp01(base + bonus - penalty), contributions };
}

export type ScoreInputs = {
  cells: HeatCellInput[];
  sensors: SensorInput[];
  places: PlaceInput[];
  events: EventInput[];
  weather: WeatherHourInput[] | null;
  weekday: string;
  startHour: number;
  endHour: number;
  slotStartMs: number;
  slotEndMs: number;
  /** Busiest footfall to scale against; defaults to the busiest sensor in this slot. */
  footfallReference?: number;
};

export type ScoredPitch = Candidate & {
  /** 0–100, rounded. */
  score: number;
  factors: Factors;
  contributions: Record<FactorName | "discovery", number | null>;
  discovery: Discovery;
  footfallSource: FootfallSource | null;
  evidence: {
    /** The sensor behind the footfall factor; with "nearby-sensors", the nearest one and the estimate. */
    sensor: { id: number; name: string; avgHourly: number } | null;
    places: NearbyPlace[];
    events: NearbyEvent[];
  };
};

export function scorePitch(candidate: Candidate, inputs: ScoreInputs, weights: Weights): ScoredPitch {
  const footfall = footfallFactor(candidate, inputs.sensors, inputs.footfallReference, inputs.cells);
  const places = placesFactor(candidate, inputs.places, inputs.weekday, inputs.startHour, inputs.endHour);
  const events = eventsFactor(candidate, inputs.events, inputs.slotStartMs, inputs.slotEndMs);
  const taste = tasteFactor(candidate, inputs.cells);
  const discovery = discoveryOf(candidate, taste);
  const factors: Factors = {
    taste,
    footfall: footfall.value === null ? null : candidate.usualSpot ? footfall.value * USUAL_SPOT_FOOTFALL_SHARE : footfall.value,
    // With no place data at all, the factor is unknown rather than zero.
    places: inputs.places.length === 0 ? null : places.value,
    events: events.value,
    weatherPenalty: weatherPenalty(inputs.weather),
    discovery: discoveryFactor(discovery, taste),
  };
  const { score, contributions } = combine(factors, weights);
  return {
    ...candidate,
    score: Math.round(clamp01(score) * 100),
    factors,
    contributions,
    discovery,
    footfallSource: footfall.source,
    evidence: {
      sensor: footfall.sensor
        ? { id: footfall.sensor.id, name: footfall.sensor.name, avgHourly: footfall.estimatedHourly ?? Math.round(footfall.sensor.avgHourly!) }
        : null,
      places: places.nearby.slice(0, 5),
      events: events.nearby,
    },
  };
}

/** Score every candidate, best first. Ties break by id for stable output. */
export function rankPitches(candidates: Candidate[], inputs: ScoreInputs, weights: Weights): ScoredPitch[] {
  return candidates
    .map((c) => scorePitch(c, inputs, weights))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** The plan's top pitches are at least this far apart, so the options differ (shown in "How pitches are scored"). */
export const MIN_PITCH_SPACING_M = 250;

/** The best `count` pitches, at least `minSpacingM` apart so the options differ. */
export function pickTopPitches(ranked: ScoredPitch[], count = 3, minSpacingM = MIN_PITCH_SPACING_M): ScoredPitch[] {
  const picked: ScoredPitch[] = [];
  for (const pitch of ranked) {
    if (picked.length === count) break;
    if (picked.every((p) => distanceM(p, pitch) >= minSpacingM)) picked.push(pitch);
  }
  return picked;
}

/** The first of `picks` (best first) closer than `minSpacingM` to `point`, or null. */
export function tooCloseTo<T extends LatLon>(point: LatLon, picks: T[], minSpacingM = MIN_PITCH_SPACING_M): T | null {
  return picks.find((p) => distanceM(p, point) < minSpacingM) ?? null;
}

/**
 * Pitches ranked above the plan's lowest pick but left out because they lie within `minSpacingM` of a pick:
 * pitch id → the pick it is too close to. `ranked` is best first and contains the picks.
 */
export function skippedForSpacing(ranked: ScoredPitch[], picks: ScoredPitch[], minSpacingM = MIN_PITCH_SPACING_M): Map<string, ScoredPitch> {
  const pickIds = new Set(picks.map((p) => p.id));
  const lastPick = Math.max(0, ...picks.map((p) => ranked.findIndex((r) => r.id === p.id)));
  const out = new Map<string, ScoredPitch>();
  for (const pitch of ranked.slice(0, lastPick)) {
    if (pickIds.has(pitch.id)) continue;
    const near = tooCloseTo(pitch, picks, minSpacingM);
    if (near) out.set(pitch.id, near);
  }
  return out;
}
