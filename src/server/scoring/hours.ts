/**
 * Best-effort opening-hours check. Qloo's hours format is not pinned down yet
 * (no key), so this accepts the common shapes and returns "unknown" otherwise:
 *   { saturday: [{ opens: "T10:00", closes: "T23:00" }] }
 *   { Saturday: ["10:00-23:00"] }
 */
export type OpenState = "open" | "closed" | "unknown";

function toHour(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) + Number(match[2]) / 60;
}

function intervals(entries: unknown): [number, number][] | null {
  if (!Array.isArray(entries)) return null;
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
      opens = toHour(record.opens);
      closes = toHour(record.closes);
    }
    if (opens === null || closes === null) return null;
    // Closing at or after midnight counts as open until the end of the day.
    out.push([opens, closes <= opens ? 24 : closes]);
  }
  return out;
}

export function openDuring(
  hours: Record<string, unknown> | null,
  weekday: string,
  startHour: number,
  endHour: number,
): OpenState {
  if (!hours) return "unknown";
  const key = Object.keys(hours).find((k) => k.toLowerCase() === weekday.toLowerCase());
  if (!key) return "unknown";
  const ranges = intervals(hours[key]);
  if (!ranges) return "unknown";
  return ranges.some(([opens, closes]) => opens < endHour && closes > startHour) ? "open" : "closed";
}
