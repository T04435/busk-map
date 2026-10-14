/**
 * A busking slot: a local date and an hour range in the city's time zone.
 * `endHour` is exclusive, so 18–21 means 6 pm to 9 pm.
 */
import { z } from "zod";

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const isoDate = z.iso.date();

export const slotSchema = z
  .object({
    date: isoDate,
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((slot) => slot.endHour > slot.startHour, {
    message: "The slot must end after it starts",
    path: ["endHour"],
  })
  .refine((slot) => slot.endHour - slot.startHour <= 6, {
    message: "A slot can be at most 6 hours long",
    path: ["endHour"],
  });

export type Slot = z.infer<typeof slotSchema>;

const DAY_MS = 86_400_000;

function dateToUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return msToDate(dateToUtcMs(date) + days * DAY_MS);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[new Date(dateToUtcMs(date)).getUTCDay()];
}

export function slotHours(slot: Slot): number[] {
  return Array.from({ length: slot.endHour - slot.startHour }, (_, i) => slot.startHour + i);
}

/**
 * The `count` most recent dates on the slot's weekday that are strictly before
 * `today`: the history used for an hour-of-week footfall baseline.
 */
export function baselineDates(slotDate: string, today: string, count: number): string[] {
  const slotDay = new Date(dateToUtcMs(slotDate)).getUTCDay();
  const todayDay = new Date(dateToUtcMs(today)).getUTCDay();
  const diff = (todayDay - slotDay + 7) % 7;
  const first = addDays(today, -(diff === 0 ? 7 : diff));
  return Array.from({ length: count }, (_, i) => addDays(first, -7 * i));
}

/** Offset of `timeZone` from UTC, in minutes, at the given instant. */
export function timeZoneOffsetMinutes(timeZone: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(atMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / 60_000);
}

/** The UTC instant of a local wall-clock hour in `timeZone`. */
export function zonedHourToUtc(date: string, hour: number, timeZone: string): Date {
  const guess = dateToUtcMs(date) + hour * 3_600_000;
  const first = guess - timeZoneOffsetMinutes(timeZone, guess) * 60_000;
  // Re-check once in case the guess sat on the other side of a DST change.
  const second = guess - timeZoneOffsetMinutes(timeZone, first) * 60_000;
  return new Date(second);
}

export function slotUtcRange(slot: Slot, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedHourToUtc(slot.date, slot.startHour, timeZone),
    end: zonedHourToUtc(slot.date, slot.endHour, timeZone),
  };
}

/** Today's date in `timeZone`. */
export function localToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The next date (today included) that falls on `weekday`. */
export function nextWeekday(weekday: Weekday, today: string): string {
  const current = new Date(dateToUtcMs(today)).getUTCDay();
  const target = WEEKDAYS.indexOf(weekday);
  return addDays(today, (target - current + 7) % 7);
}

export function formatHour(hour: number): string {
  const h = hour % 24;
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

export function describeSlot(slot: Slot): string {
  const day = weekdayOf(slot.date);
  return `${day[0].toUpperCase()}${day.slice(1)} ${slot.date}, ${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`;
}
