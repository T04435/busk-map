import { distanceM, type LatLon } from "@/lib/geo";
import { openDuring } from "./hours";
import type {
  Candidate,
  EventInput,
  FactorName,
  Factors,
  HeatCellInput,
  PlaceInput,
  SensorInput,
  WeatherHourInput,
  Weights,
} from "./types";

// ---- Radii and constants (documented in the UI's "how we score") ----------

export const TASTE_RADIUS_M = 600;
export const FOOTFALL_RADIUS_M = 250;
export const PLACES_RADIUS_M = 250;
export const EVENTS_RADIUS_M = 800;
/** Crowds arrive in the hour before an event and leave within 45 minutes of the end. */
export const EVENT_ARRIVAL_MS = 60 * 60_000;
export const EVENT_EXIT_MS = 45 * 60_000;
/** Saturation constant for summed place popularity. */
export const PLACES_SATURATION = 1.5;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Taste affinity near a point, relative to the best cell in the city (so the
 * strongest area scores 1). Inverse-distance weighted over cells within the
 * radius; null when there are no cells.
 */
export function tasteFactor(point: LatLon, cells: HeatCellInput[]): number | null {
  if (cells.length === 0) return null;
  const max = Math.max(...cells.map((c) => c.affinity));
  if (max <= 0) return 0;
  let weighted = 0;
  let total = 0;
  for (const cell of cells) {
    const d = distanceM(point, cell);
    if (d > TASTE_RADIUS_M) continue;
    const w = 1 / Math.max(d, 50);
    weighted += w * cell.affinity;
    total += w;
  }
  return total === 0 ? 0 : clamp01(weighted / total / max);
}

/**
 * Foot traffic for the slot at the nearest sensor within the radius, on a log
 * scale relative to the busiest sensor. Null when no sensor is close enough
 * (the weight then drops out rather than scoring zero).
 */
export function footfallFactor(point: LatLon, sensors: SensorInput[]): { value: number | null; sensor: SensorInput | null } {
  const counted = sensors.filter((s): s is SensorInput & { avgHourly: number } => s.avgHourly !== null);
  if (counted.length === 0) return { value: null, sensor: null };
  const max = Math.max(...counted.map((s) => s.avgHourly));
  let nearest: (SensorInput & { avgHourly: number }) | null = null;
  let nearestD = Number.POSITIVE_INFINITY;
  for (const sensor of counted) {
    const d = distanceM(point, sensor);
    if (d <= FOOTFALL_RADIUS_M && d < nearestD) {
      nearest = sensor;
      nearestD = d;
    }
  }
  if (!nearest) return { value: null, sensor: null };
  return { value: max <= 0 ? 0 : clamp01(Math.log1p(nearest.avgHourly) / Math.log1p(max)), sensor: nearest };
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
    best = Math.max(best, proximity * (leaving ? 1 : 0.7));
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

/** Combine factors with weights. Missing factors drop out of the weighted mean. */
export function combine(factors: Factors, weights: Weights): { score: number; contributions: Record<FactorName, number | null> } {
  let weighted = 0;
  let total = 0;
  const contributions = {} as Record<FactorName, number | null>;
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
  const penalty = factors.weatherPenalty === null ? 0 : weights.weather * factors.weatherPenalty;
  return { score: clamp01(base - penalty), contributions };
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
};

export type ScoredPitch = Candidate & {
  /** 0–100, rounded. */
  score: number;
  factors: Factors;
  contributions: Record<FactorName, number | null>;
  evidence: {
    sensor: { id: number; name: string; avgHourly: number } | null;
    places: NearbyPlace[];
    events: NearbyEvent[];
  };
};

export function scorePitch(candidate: Candidate, inputs: ScoreInputs, weights: Weights): ScoredPitch {
  const footfall = footfallFactor(candidate, inputs.sensors);
  const places = placesFactor(candidate, inputs.places, inputs.weekday, inputs.startHour, inputs.endHour);
  const events = eventsFactor(candidate, inputs.events, inputs.slotStartMs, inputs.slotEndMs);
  const factors: Factors = {
    taste: tasteFactor(candidate, inputs.cells),
    footfall: footfall.value,
    // With no place data at all, the factor is unknown rather than zero.
    places: inputs.places.length === 0 ? null : places.value,
    events: events.value,
    weatherPenalty: weatherPenalty(inputs.weather),
  };
  const { score, contributions } = combine(factors, weights);
  return {
    ...candidate,
    score: Math.round(score * 100),
    factors,
    contributions,
    evidence: {
      sensor: footfall.sensor ? { id: footfall.sensor.id, name: footfall.sensor.name, avgHourly: Math.round(footfall.sensor.avgHourly!) } : null,
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

/** The best `count` pitches, at least `minSpacingM` apart so the options differ. */
export function pickTopPitches(ranked: ScoredPitch[], count = 3, minSpacingM = 250): ScoredPitch[] {
  const picked: ScoredPitch[] = [];
  for (const pitch of ranked) {
    if (picked.length === count) break;
    if (picked.every((p) => distanceM(p, pitch) >= minSpacingM)) picked.push(pitch);
  }
  return picked;
}
