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

/** The hour of day (0-23) in `timeZone` at `now`. */
export function localHour(timeZone: string, now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit" }).formatToParts(now).find((p) => p.type === "hour");
  return Number(hour?.value ?? 0) % 24;
}

/** The city's current local date and hour: what a page needs to pick the next slot that hasn't ended. */
export function localNow(timeZone: string, now: Date = new Date()): { today: string; hour: number } {
  return { today: localToday(timeZone, now), hour: localHour(timeZone, now) };
}

/**
 * The next date on `weekday` whose slot has not ENDED yet, in the city's time zone: today if today is that weekday and
 * the slot is still on (or hasn't started), otherwise the next one. `endHour` at or before `startHour`, or past 24,
 * means the slot runs over midnight, so the evening before's slot is still live after midnight.
 */
export function nextSlotDate(weekday: Weekday, startHour: number, endHour: number, today: string, nowHour: number): string {
  const end = endHour <= startHour ? endHour + 24 : endHour;
  const nowAbs = nowHour; // hours since the start of `today`
  for (let k = -1; k <= 7; k++) {
    const date = addDays(today, k);
    if (weekdayOf(date) !== weekday) continue;
    // Hours from the start of `today` to the end of this date's slot.
    if (k * 24 + end > nowAbs) return date;
  }
  return nextWeekday(weekday, today);
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

const PERMIT_NAME: Record<string, string> = { general: "General permit", premium: "Premium permit", "circle-act": "Circle act" };
const SHORT_DAY = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The permit as the app names it: "General permit", "Premium permit", "Circle act". */
export function permitName(permit: string): string {
  return PERMIT_NAME[permit] ?? permit;
}

/** "Sun 19 Oct": the slot's day, short (no year, no ISO). */
export function shortDay(date: string): string {
  return SHORT_DAY.format(new Date(dateToUtcMs(date))).replace(/,/g, "");
}

/** "12–3 pm", or "6 pm–12 am" when the slot crosses noon or midnight. */
export function shortHours(startHour: number, endHour: number): string {
  const a = formatHour(startHour);
  const b = formatHour(endHour);
  const [an, as] = a.split(" ");
  const [bn, bs] = b.split(" ");
  return as === bs ? `${an}–${bn} ${bs}` : `${a}–${b}`;
}

/** The plan page's eyebrow: "Sun 19 Oct · 12–3 pm · General permit". No city (F20). */
export function slotEyebrow(slot: Slot, permit: string): string {
  return `${shortDay(slot.date)} · ${shortHours(slot.startHour, slot.endHour)} · ${permitName(permit)}`;
}

/** "on Friday night", "on Sunday afternoon": the day and a word for the hours (the no-legal-pitch title). */
export function nightWord(slot: Slot): string {
  const day = weekdayOf(slot.date);
  const part = slot.startHour >= 17 || slot.startHour < 4 ? "night" : slot.startHour >= 12 ? "afternoon" : "morning";
  return `on ${day[0].toUpperCase()}${day.slice(1)} ${part}`;
}
