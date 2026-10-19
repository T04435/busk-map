import type { TimeWindow } from "@/lib/slot";
import { scorePitch, type ScoreInputs, type ScoredPitch } from "./pitch-score";
import type { Candidate, EventInput, HeatCellInput, PlaceInput, WeatherHourInput, Weights } from "./types";

/**
 * Any time: score each pitch in every 3-hour window of the day (10 am to 10 pm) with the same engine as a fixed slot,
 * and keep its best window (plan-inputs-architecture.md 2.2). The windows differ in which Qloo places are open (the activity
 * estimate's hour-of-day variation), in the events arriving or leaving and in the weather, so the best window is where the
 * most popular places are open and the crowd is out. Pure: no I/O, no clock.
 */

/** Everything one day's windows are scored from, fetched once. */
export type AnyTimeBase = {
  weekday: string;
  cells: HeatCellInput[];
  places: PlaceInput[];
  events: EventInput[];
  /** The day's forecast hours; null when there is no forecast. */
  weather: (WeatherHourInput & { hour: number })[] | null;
  /** The UTC instant (ms) of a local hour on the date. */
  hourMs: (hour: number) => number;
};

/** The engine's inputs for one window. */
export function windowInputs(base: AnyTimeBase, window: TimeWindow): ScoreInputs {
  return {
    cells: base.cells,
    places: base.places,
    events: base.events,
    weather: base.weather ? base.weather.filter((h) => h.hour >= window.startHour && h.hour < window.endHour) : null,
    weekday: base.weekday,
    startHour: window.startHour,
    endHour: window.endHour,
    slotStartMs: base.hourMs(window.startHour),
    slotEndMs: base.hourMs(window.endHour),
  };
}

/** The candidate scored in each window, in window order. */
export function scoreWindows(candidate: Candidate, base: AnyTimeBase, windows: readonly TimeWindow[], weights: Weights): ScoredPitch[] {
  return windows.map((w) => ({ ...scorePitch(candidate, windowInputs(base, w), weights), window: { startHour: w.startHour, endHour: w.endHour, runnersUp: [] } }));
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
export function scorePitchAnyTime(candidate: Candidate, base: AnyTimeBase, windows: readonly TimeWindow[], weights: Weights): ScoredPitch | null {
  return bestWindow(scoreWindows(candidate, base, windows, weights));
}

/** Every candidate at its best window, ranked by that window's score, best first. Ties break by id. */
export function rankPitchesAnyTime(candidates: Candidate[], base: AnyTimeBase, windows: readonly TimeWindow[], weights: Weights): ScoredPitch[] {
  return candidates
    .flatMap((c) => {
      const best = scorePitchAnyTime(c, base, windows, weights);
      return best ? [best] : [];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
