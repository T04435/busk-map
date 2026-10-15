/**
 * Opening-hours check for Qloo places. Live shape (verified 2026-10-15):
 *   { saturday: [{ opens: "T12:00:00", closes: "T02:00:00", closed: false }],
 *     sunday:   [{ opens: null, closes: null, closed: true }] }
 * Weekday keys are lowercase, a day may have several ranges, and a closing
 * time at or before the opening time runs past midnight into the next day
 * (12:00 to 02:00 means open until 2 am). So a slot is also open when the
 * previous day's late range is still going. Simple "10:00-23:00" strings are
 * accepted too; anything unreadable is "unknown".
 */
export type OpenState = "open" | "closed" | "unknown";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function toHour(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) + Number(match[2]) / 60;
}

/** A day's ranges in hours from that day's midnight; past-midnight closing goes beyond 24. Null when unreadable. */
function intervals(entries: unknown): [number, number][] | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const out: [number, number][] = [];
  for (const entry of entries) {
    let opens: number | null = null;
    let closes: number | null = null;
    if (typeof entry === "string") {
      const [a, b] = entry.split(/[-–]/);
      opens = toHour(a);
      closes = toHour(b);
    } else if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      if (record.closed === true) continue;
      opens = toHour(record.opens);
      closes = toHour(record.closes);
    }
    if (opens === null || closes === null) return null;
    out.push([opens, closes <= opens ? closes + 24 : closes]);
  }
  return out;
}

function dayEntries(hours: Record<string, unknown>, weekday: string): unknown {
  const key = Object.keys(hours).find((k) => k.toLowerCase() === weekday);
  return key === undefined ? undefined : hours[key];
}

export function openDuring(
  hours: Record<string, unknown> | null,
  weekday: string,
  startHour: number,
  endHour: number,
): OpenState {
  if (!hours) return "unknown";
  const day = weekday.toLowerCase();
  const ranges = intervals(dayEntries(hours, day));
  if (!ranges) return "unknown";
  const index = WEEKDAYS.indexOf(day);
  const previous = index === -1 ? null : intervals(dayEntries(hours, WEEKDAYS[(index + 6) % 7]));
  // The previous day's ranges that run past midnight, in this day's hours.
  const spill = (previous ?? []).filter(([, closes]) => closes > 24).map(([, closes]): [number, number] => [0, closes - 24]);
  return [...ranges, ...spill].some(([opens, closes]) => opens < endHour && closes > startHour) ? "open" : "closed";
}
