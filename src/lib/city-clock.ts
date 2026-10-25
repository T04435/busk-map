/**
 * The busk form's clock, per city. "Today" and the default date are the selected city's, not Melbourne's: at 11 pm in Melbourne
 * it is still the same morning in Bogota. Client-safe and pure: the server hands the form one instant (its clock, which the
 * test switch BUSKMAP_FAKE_NOW freezes) and the form reads it in whatever city is picked.
 */
import { localNow, nextAnyTimeDate, nextSlotDate, type Weekday } from "./slot";

/** How the form picks its default date: the next date an any-time window can still start, or the next such weekday's slot (planning again). */
export type DefaultDateRule = { kind: "any" } | { kind: "weekday"; weekday: Weekday; startHour: number; endHour: number };

/** The city's local date and hour at an instant (an ISO string, as the server passes it). */
export function cityNow(timeZone: string, instant: string): { today: string; hour: number } {
  return localNow(timeZone, new Date(instant));
}

/** The form's default date in a city: the rule applied to the city's own today and hour. */
export function defaultDateIn(rule: DefaultDateRule, timeZone: string, instant: string): string {
  const { today, hour } = cityNow(timeZone, instant);
  return rule.kind === "any" ? nextAnyTimeDate(today, hour) : nextSlotDate(rule.weekday, rule.startHour, rule.endHour, today, hour);
}
