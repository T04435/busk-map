/**
 * Date-only values for the date pickers. The app passes dates around as
 * YYYY-MM-DD strings; the calendar works with local-midnight Date objects.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-24" → local midnight on 24 October 2026, or null when malformed. */
export function isoToLocalDate(iso: string): Date | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** A local Date → "YYYY-MM-DD" (its calendar day where the browser is). */
export function localDateToIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-24" → "Sat 24 Oct 2026". Falls back to the raw value when malformed. */
export function formatIsoDate(iso: string): string {
  const date = isoToLocalDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "");
}

