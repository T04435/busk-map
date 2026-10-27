/**
 * A week before or without its run (client-safe): the days from the request, pending or can't play, with the city's name,
 * time zone and whether its busking rules are checked. The server's record fills in the rest.
 */
import { cityOfRequest, isMelbourne, MELBOURNE } from "./city";
import { formatHour, weekdayOf } from "./slot";
import { isAnyTimeDay, isOffDay, weekDayLabel, weekResultSchema, type WeekDayResult, type WeekRequest, type WeekResult } from "./week-schema";

/** What a playable day whose hours are over says. */
export const PASSED_REASON = "Its hours have already passed.";

export const windowOf = (s: { startHour: number; endHour: number }) => `${formatHour(s.startHour)}–${formatHour(s.endHour)}`;

export type ShellDay = { status: WeekDayResult["status"]; planId: string | null; reason: string | null };

export function weekShellFor(
  request: WeekRequest,
  { id = null, days = null, passed = new Set(), qlooMode }: { id?: string | null; days?: readonly ShellDay[] | null; passed?: ReadonlySet<string>; qlooMode: "live" | "synthetic" },
): WeekResult {
  const city = cityOfRequest(request) ?? MELBOURNE;
  const melbourne = isMelbourne(city);
  return weekResultSchema.parse({
    version: 3,
    id,
    status: "running",
    city: request.city,
    cityName: city.name,
    timeZone: city.timeZone,
    center: city.center,
    tasteCells: [],
    rulesChecked: melbourne,
    permit: melbourne ? request.permit : "general",
    performerName: request.performer.name,
    artists: request.performer.artists,
    startDate: request.startDate,
    summary: null,
    days: request.days.map((d, i): WeekDayResult => {
      const stored = days?.[i];
      const base = { date: d.date, weekday: weekdayOf(d.date), label: weekDayLabel(d.date), pitch: null, planId: stored?.planId ?? null, weather: null };
      if (isOffDay(d)) return { ...base, status: "cant-play", slot: null, window: null, anyTime: false, reason: null };
      const anyTime = isAnyTimeDay(d);
      const status = stored?.status ?? (passed.has(d.date) ? "cant-play" : "pending");
      return { ...base, status, slot: anyTime ? null : { startHour: d.startHour, endHour: d.endHour }, window: anyTime ? "Any time" : windowOf(d), anyTime, reason: stored?.reason ?? (passed.has(d.date) ? PASSED_REASON : null) };
    }),
    notes: [],
    qlooMode,
    explanationsModel: null,
    researchTotals: null,
    usage: null,
    dataStatus: [],
    error: null,
  });
}
