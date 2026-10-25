import { distanceM, type LatLon } from "@/lib/geo";
import { activityEstimate, type NearbyPlace } from "./activity";
import { FINE_TASTE_RADIUS_M, TASTE_RADIUS_M, isFineHeatmap } from "./heatmap";
import type { Candidate, Discovery, EventInput, FactorName, Factors, HeatCellInput, PlaceInput, WeatherHourInput, Weights } from "./types";
import type { ActivityBasis } from "@/lib/activity";

export { FINE_GEOHASH_PRECISION, FINE_TASTE_RADIUS_M, TASTE_RADIUS_M, isFineHeatmap } from "./heatmap";

// ---- Radii and constants (documented in the UI's "how we score") ----------

/** A pitch off the usual circuit with at least this taste fit is a hidden gem. */
export const HIDDEN_GEM_MIN_TASTE = 0.6;
/**
 * At a well-known hotspot the crowd is shared with the other buskers who go
 * there: its activity counts for this share.
 */
export const USUAL_SPOT_ACTIVITY_SHARE = 0.85;
/** ...and earns the discovery bonus from this fit up. */
export const DISCOVERY_BONUS_MIN_TASTE = 0.75;
export const EVENTS_RADIUS_M = 800;
/** Crowds arrive in the hour before an event and leave within 45 minutes of the end. */
export const EVENT_ARRIVAL_MS = 60 * 60_000;
export const EVENT_EXIT_MS = 45 * 60_000;

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

/** Hidden gem: off the usual circuit with a strong taste fit. Usual spot: at a well-known hotspot. */
export function discoveryOf(candidate: Pick<Candidate, "usualSpot">, taste: number | null): Discovery {
  if (candidate.usualSpot) return "usual";
  return taste !== null && taste >= HIDDEN_GEM_MIN_TASTE ? "hidden-gem" : null;
}

/** The discovery bonus: a hidden gem's taste fit, from DISCOVERY_BONUS_MIN_TASTE up; otherwise 0. */
export function discoveryFactor(discovery: Discovery, taste: number | null): number {
  return discovery === "hidden-gem" && taste !== null && taste >= DISCOVERY_BONUS_MIN_TASTE ? taste : 0;
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

const FACTORS: FactorName[] = ["taste", "activity", "events"];

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
  contributions: Record<FactorName | "discovery", number | null>;
  discovery: Discovery;
  /** What the activity estimate was made from ("none": Qloo had nothing, the factor is left out). */
  activityBasis: ActivityBasis;
  evidence: {
    /** The activity estimate's parts for the slot: the pitch's level (before the usual-spot share), the heatmap's popularity there and the open venues. */
    activity: { level: number; area: number | null; venues: number | null };
    places: NearbyPlace[];
    events: NearbyEvent[];
  };
  /** Any-time plans only: the 3-hour window this pitch scored best in, and the next best two. */
  window?: { startHour: number; endHour: number; runnersUp: { startHour: number; endHour: number; score: number }[] };
};

export function scorePitch(candidate: Candidate, inputs: ScoreInputs, weights: Weights): ScoredPitch {
  const activity = activityEstimate(candidate, { cells: inputs.cells, places: inputs.places, weekday: inputs.weekday }, inputs.startHour, inputs.endHour);
  const events = eventsFactor(candidate, inputs.events, inputs.slotStartMs, inputs.slotEndMs);
  const taste = tasteFactor(candidate, inputs.cells);
  const discovery = discoveryOf(candidate, taste);
  const factors: Factors = {
    taste,
    // With nothing from Qloo to estimate from, the factor is unknown rather than zero (it drops out of the weighted mean).
    activity: activity.basis === "none" ? null : candidate.usualSpot ? activity.level * USUAL_SPOT_ACTIVITY_SHARE : activity.level,
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
    activityBasis: activity.basis,
    evidence: {
      activity: { level: activity.level, area: activity.area, venues: activity.venues },
      places: activity.nearby.slice(0, 5),
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

/** How the top pitches spread over a metro's districts (scoring/districts.ts): each pitch's district, and the most per district. */
export type DistrictSpread = { districtOf: (point: LatLon) => string | null; maxPerDistrict: number };

/**
 * The best `count` pitches, at least `minSpacingM` apart so the options differ. With `spread` (a metro planned in districts),
 * at most `maxPerDistrict` come from one district while other districts have pitches; only when they run out is the rest
 * filled from the best left, so a plan still has `count` pitches.
 */
export function pickTopPitches(ranked: ScoredPitch[], count = 3, minSpacingM = MIN_PITCH_SPACING_M, spread?: DistrictSpread): ScoredPitch[] {
  const picked: ScoredPitch[] = [];
  const spaced = (pitch: ScoredPitch) => picked.every((p) => distanceM(p, pitch) >= minSpacingM);
  if (spread) {
    const perDistrict = new Map<string, number>();
    for (const pitch of ranked) {
      if (picked.length === count) break;
      const district = spread.districtOf(pitch);
      const n = district === null ? 0 : (perDistrict.get(district) ?? 0);
      if (n >= spread.maxPerDistrict || !spaced(pitch)) continue;
      picked.push(pitch);
      if (district !== null) perDistrict.set(district, n + 1);
    }
    if (picked.length < count) {
      for (const pitch of ranked) {
        if (picked.length === count) break;
        if (!picked.includes(pitch) && spaced(pitch)) picked.push(pitch);
      }
      picked.sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b));
    }
    return picked;
  }
  for (const pitch of ranked) {
    if (picked.length === count) break;
    if (spaced(pitch)) picked.push(pitch);
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
