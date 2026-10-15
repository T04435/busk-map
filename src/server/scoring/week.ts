import type { LatLon } from "@/lib/geo";
import { pickTopPitches, rankPitches, type ScoredPitch } from "./pitch-score";
import type { TipHistory } from "./tips";
import type { Candidate, EventInput, HeatCellInput, PlaceInput, WeatherHourInput, Weights } from "./types";

/**
 * Week planner: score every (day × slot × legal pitch) with the same engine
 * as a single plan, then choose sessions within the performer's limits.
 * Pure and cheap: all inputs are fetched once for the whole week.
 */

/** Standard 3-hour busking windows, local time. */
export const WEEK_SLOTS: readonly { startHour: number; endHour: number }[] = [
  { startHour: 10, endHour: 13 },
  { startHour: 13, endHour: 16 },
  { startHour: 16, endHour: 19 },
  { startHour: 19, endHour: 22 },
];

export type WeekDay = {
  date: string;
  weekday: string;
  /** UTC instants for each WEEK_SLOTS entry, same order. */
  slots: { startHour: number; endHour: number; startMs: number; endMs: number }[];
};

export type TypicalSensor = LatLon & {
  id: number;
  name: string;
  /** Typical pedestrians per hour by weekday ("monday") and local hour. */
  byWeekdayHour: Record<string, Record<number, number>>;
};

export type WeekInputs = {
  days: WeekDay[];
  cells: HeatCellInput[];
  sensors: TypicalSensor[];
  places: PlaceInput[];
  events: EventInput[];
  /** Forecast hours keyed by date; missing dates mean no forecast. */
  weather: Record<string, (WeatherHourInput & { hour: number })[]>;
  /** The performer's logged takings, for the personal bonus. */
  history?: TipHistory | null;
};

export type WeekCell = {
  date: string;
  weekday: string;
  startHour: number;
  endHour: number;
  /** The best pitch for this slot, or null when no candidate scores. */
  best: ScoredPitch | null;
  /** The slot's best pitches, best first (best is the first): the next one stands in when a pitch reaches its cap. */
  options?: ScoredPitch[];
};

/** At most this many sessions at one pitch in a week. */
export const MAX_SESSIONS_PER_PITCH = 2;
/** Pitches kept per slot as stand-ins for a capped pitch. */
export const WEEK_OPTIONS_PER_SLOT = 6;

/** Average typical footfall over the slot's hours; null when the sensor has no data then. */
export function typicalForSlot(sensor: TypicalSensor, weekday: string, startHour: number, endHour: number): number | null {
  const byHour = sensor.byWeekdayHour[weekday] ?? {};
  const values: number[] = [];
  for (let h = startHour; h < endHour; h++) if (byHour[h] !== undefined) values.push(byHour[h]);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Score the whole week: one ranked list per (day, slot), keeping the best pitch. */
export function scoreWeek(candidates: Candidate[], inputs: WeekInputs, weights: Weights): WeekCell[] {
  const cells: WeekCell[] = [];
  // Scale footfall against the busiest typical slot of the week, so a quiet
  // Monday morning doesn't score like a busy Saturday night.
  const typicals = inputs.days.flatMap((day) =>
    day.slots.flatMap((slot) => inputs.sensors.map((s) => typicalForSlot(s, day.weekday, slot.startHour, slot.endHour) ?? 0)),
  );
  const footfallReference = Math.max(0, ...typicals);
  for (const day of inputs.days) {
    const forecast = inputs.weather[day.date];
    for (const slot of day.slots) {
      const ranked = rankPitches(
        candidates,
        {
          cells: inputs.cells,
          sensors: inputs.sensors.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, avgHourly: typicalForSlot(s, day.weekday, slot.startHour, slot.endHour) })),
          places: inputs.places,
          events: inputs.events,
          weather: forecast ? forecast.filter((h) => h.hour >= slot.startHour && h.hour < slot.endHour) : null,
          weekday: day.weekday,
          startHour: slot.startHour,
          endHour: slot.endHour,
          slotStartMs: slot.startMs,
          slotEndMs: slot.endMs,
          footfallReference,
          history: inputs.history,
        },
        weights,
      );
      const options = pickTopPitches(ranked, WEEK_OPTIONS_PER_SLOT, 0);
      cells.push({ date: day.date, weekday: day.weekday, startHour: slot.startHour, endHour: slot.endHour, best: options[0] ?? null, options });
    }
  }
  return cells;
}

export type Unavailable = { date: string; startHour: number; endHour: number };

export type WeekLimits = {
  /** At most this many sessions in the week (1–5). */
  maxSessions: number;
  /** At most this many sessions on one day. */
  maxPerDay: number;
  /** At most this many sessions at one pitch (default MAX_SESSIONS_PER_PITCH). */
  maxPerPitch?: number;
  /** Times the performer can't play. A slot that overlaps any of them is skipped. */
  unavailable: Unavailable[];
};

export function isUnavailable(cell: Pick<WeekCell, "date" | "startHour" | "endHour">, unavailable: Unavailable[]): boolean {
  return unavailable.some((u) => u.date === cell.date && u.startHour < cell.endHour && u.endHour > cell.startHour);
}

/**
 * Pick the best sessions, greedily, within the limits: each slot at most once,
 * at most `maxPerDay` a day and `maxPerPitch` at one pitch. A slot whose best
 * pitch is capped can still be chosen with its next-best pitch. Ties go to the
 * earlier slot, then the slot's better option.
 */
export function selectSessions(grid: WeekCell[], limits: WeekLimits): (WeekCell & { best: ScoredPitch })[] {
  const maxPerPitch = limits.maxPerPitch ?? MAX_SESSIONS_PER_PITCH;
  const perDay = new Map<string, number>();
  const perPitch = new Map<string, number>();
  const taken = new Set<WeekCell>();
  const chosen: (WeekCell & { best: ScoredPitch })[] = [];
  const pairs = grid
    .filter((c) => !isUnavailable(c, limits.unavailable))
    .flatMap((cell) => (cell.options ?? (cell.best ? [cell.best] : [])).map((pitch, rank) => ({ cell, pitch, rank })))
    .filter(({ pitch }) => pitch.score > 0)
    .sort((a, b) => b.pitch.score - a.pitch.score || a.cell.date.localeCompare(b.cell.date) || a.cell.startHour - b.cell.startHour || a.rank - b.rank);
  for (const { cell, pitch } of pairs) {
    if (chosen.length >= limits.maxSessions) break;
    if (taken.has(cell)) continue;
    if ((perDay.get(cell.date) ?? 0) >= limits.maxPerDay) continue;
    if ((perPitch.get(pitch.id) ?? 0) >= maxPerPitch) continue;
    taken.add(cell);
    perDay.set(cell.date, (perDay.get(cell.date) ?? 0) + 1);
    perPitch.set(pitch.id, (perPitch.get(pitch.id) ?? 0) + 1);
    chosen.push({ ...cell, best: pitch });
  }
  return chosen;
}
