import { ANY_TIME_WINDOWS, type TimeWindow } from "@/lib/slot";
import { scorePitch, type ScoreInputs, type ScoredPitch } from "./pitch-score";
import { typicalForSlot, type TypicalSensor } from "./week";
import type { Candidate, EventInput, HeatCellInput, PlaceInput, WeatherHourInput, Weights } from "./types";

/**
 * Any time: score each pitch in every 3-hour window of the day (10 am to 10 pm) with the same engine as a fixed slot,
 * and keep its best window (plan-inputs-architecture.md 2.2). Pure: no I/O, no clock.
 */

/** Everything one day's windows are scored from, fetched once. */
export type AnyTimeBase = {
  weekday: string;
  cells: HeatCellInput[];
  /** Typical foot traffic by weekday and hour. */
  sensors: TypicalSensor[];
  places: PlaceInput[];
  events: EventInput[];
  /** The day's forecast hours; null when there is no forecast. */
  weather: (WeatherHourInput & { hour: number })[] | null;
  /** The UTC instant (ms) of a local hour on the date. */
  hourMs: (hour: number) => number;
};

/**
 * Footfall is scaled against the busiest typical window of the day across all sensors, so a quiet 10 am doesn't score
 * like a busy 6 pm. All the day's windows count, not only those still ahead, so the scale doesn't move with the hour.
 */
export function footfallReferenceOf(base: Pick<AnyTimeBase, "sensors" | "weekday">): number {
  const values = ANY_TIME_WINDOWS.flatMap((w) => base.sensors.map((s) => typicalForSlot(s, base.weekday, w.startHour, w.endHour) ?? 0));
  return Math.max(0, ...values);
}

/** The engine's inputs for one window. */
export function windowInputs(base: AnyTimeBase, window: TimeWindow, footfallReference: number): ScoreInputs {
  return {
    cells: base.cells,
    sensors: base.sensors.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, avgHourly: typicalForSlot(s, base.weekday, window.startHour, window.endHour) })),
    places: base.places,
    events: base.events,
    weather: base.weather ? base.weather.filter((h) => h.hour >= window.startHour && h.hour < window.endHour) : null,
    weekday: base.weekday,
    startHour: window.startHour,
    endHour: window.endHour,
    slotStartMs: base.hourMs(window.startHour),
    slotEndMs: base.hourMs(window.endHour),
    footfallReference,
  };
}

/** The candidate scored in each window, in window order. */
export function scoreWindows(candidate: Candidate, base: AnyTimeBase, windows: readonly TimeWindow[], weights: Weights, footfallReference = footfallReferenceOf(base)): ScoredPitch[] {
  return windows.map((w) => ({ ...scorePitch(candidate, windowInputs(base, w, footfallReference), weights), window: { startHour: w.startHour, endHour: w.endHour, runnersUp: [] } }));
}

/**
 * The window the pitch scores best in (ties go to the earlier window), with the next two best as runners-up.
 * Null when no window is left.
 */
export function bestWindow(scored: ScoredPitch[]): ScoredPitch | null {
  if (scored.length === 0) return null;
  let best = scored[0];
  for (const s of scored) if (s.score > best.score) best = s;
  const runnersUp = scored
    .filter((s) => s !== best)
    .sort((a, b) => b.score - a.score || a.window!.startHour - b.window!.startHour)
    .slice(0, 2)
    .map((s) => ({ startHour: s.window!.startHour, endHour: s.window!.endHour, score: s.score }));
  return { ...best, window: { startHour: best.window!.startHour, endHour: best.window!.endHour, runnersUp } };
}

/** Score one candidate at its best window. */
export function scorePitchAnyTime(candidate: Candidate, base: AnyTimeBase, windows: readonly TimeWindow[], weights: Weights, footfallReference = footfallReferenceOf(base)): ScoredPitch | null {
  return bestWindow(scoreWindows(candidate, base, windows, weights, footfallReference));
}

/** Every candidate at its best window, ranked by that window's score, best first. Ties break by id. */
export function rankPitchesAnyTime(candidates: Candidate[], base: AnyTimeBase, windows: readonly TimeWindow[], weights: Weights): ScoredPitch[] {
  const reference = footfallReferenceOf(base);
  return candidates
    .flatMap((c) => {
      const best = scorePitchAnyTime(c, base, windows, weights, reference);
      return best ? [best] : [];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
