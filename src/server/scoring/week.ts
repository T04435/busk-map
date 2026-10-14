import type { LatLon } from "@/lib/geo";
import { pickTopPitches, rankPitches, type ScoredPitch } from "./pitch-score";
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
};

export type WeekCell = {
  date: string;
  weekday: string;
  startHour: number;
  endHour: number;
  /** The best pitch for this slot, or null when no candidate scores. */
  best: ScoredPitch | null;
};

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
        },
        weights,
      );
      cells.push({ date: day.date, weekday: day.weekday, startHour: slot.startHour, endHour: slot.endHour, best: pickTopPitches(ranked, 1)[0] ?? null });
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
  /** Times the performer can't play. A slot that overlaps any of them is skipped. */
  unavailable: Unavailable[];
};

export function isUnavailable(cell: Pick<WeekCell, "date" | "startHour" | "endHour">, unavailable: Unavailable[]): boolean {
  return unavailable.some((u) => u.date === cell.date && u.startHour < cell.endHour && u.endHour > cell.startHour);
}

/** Pick the best sessions, greedily, within the limits. Ties go to the earlier slot. */
export function selectSessions(grid: WeekCell[], limits: WeekLimits): (WeekCell & { best: ScoredPitch })[] {
  const perDay = new Map<string, number>();
  const chosen: (WeekCell & { best: ScoredPitch })[] = [];
  const ordered = grid
    .filter((c): c is WeekCell & { best: ScoredPitch } => c.best !== null && c.best.score > 0)
    .filter((c) => !isUnavailable(c, limits.unavailable))
    .sort((a, b) => b.best.score - a.best.score || a.date.localeCompare(b.date) || a.startHour - b.startHour);
  for (const cell of ordered) {
    if (chosen.length >= limits.maxSessions) break;
    const used = perDay.get(cell.date) ?? 0;
    if (used >= limits.maxPerDay) continue;
    perDay.set(cell.date, used + 1);
    chosen.push(cell);
  }
  return chosen;
}
