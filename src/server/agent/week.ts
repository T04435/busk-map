import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { addDays, formatHour, weekdayOf, zonedHourToUtc } from "@/lib/slot";
import { weekPlanSchema, type WeekPlan, type WeekRequest, type WeekSession } from "@/lib/week-schema";
import type { AdapterContext, AdapterName, AdapterResult } from "@/server/adapters/core";
import { getEventsBetween } from "@/server/adapters/events";
import { getTypicalFootfall } from "@/server/adapters/footfall";
import { getPitches } from "@/server/adapters/pitches";
import * as qloo from "@/server/adapters/qloo";
import { getWeatherWeek } from "@/server/adapters/weather";
import { CITIES } from "@/server/cities";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import {
  buildCandidates,
  normalizeWeights,
  scoreWeek,
  selectSessions,
  WEEK_SLOTS,
  type ScoredPitch,
  type WeekCell,
  type WeekDay,
} from "@/server/scoring";
import { PLACES_RADIUS_M } from "./context";
import { createMockWeekExplainer } from "./mock-model";
import { MODELS } from "./models";

export const WEEK_DAYS = 7;

type Status = { adapter: AdapterName; source: string; mode: AdapterResult<unknown>["mode"]; reason?: string };

export class WeekQlooUnavailableError extends Error {}

const capitalise = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
export const sessionKey = (date: string, startHour: number) => `${date}@${startHour}`;

/** A plain "why" for a session, from the evidence only. */
export function templateSessionWhy(cell: WeekCell & { best: ScoredPitch }): string {
  const p = cell.best;
  const parts: string[] = [];
  if (p.factors.taste !== null) parts.push(`Taste match ${Math.round(p.factors.taste * 100)}/100 here (Qloo).`);
  if (p.evidence.sensor) parts.push(`Typically about ${p.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour at ${p.evidence.sensor.name} on ${capitalise(cell.weekday)}s at this time (estimate).`);
  if (p.evidence.events[0]) parts.push(`${p.evidence.events[0].name} crowd ${p.evidence.events[0].moment === "leaving" ? "leaving" : "arriving"} nearby.`);
  if (p.factors.weatherPenalty !== null && p.factors.weatherPenalty > 0.3) parts.push("Some weather risk in the forecast.");
  return parts.join(" ") || "Scored on the data available for this slot.";
}

const explanationSchema = z.object({
  summary: z.string().max(500),
  sessions: z.array(z.object({ key: z.string(), why: z.string().max(400) })).max(5),
});

/** Build the week plan; `explain` asks the model to explain the chosen sessions only. */
export async function buildWeekPlan(
  request: WeekRequest,
  adapters: AdapterContext,
  today: string,
  explain: boolean,
  now: Date = new Date(),
): Promise<WeekPlan> {
  const city = CITIES[request.city];
  const statuses = new Map<string, Status>();
  const notes: string[] = [];
  const track = <T>(result: AdapterResult<T>): T => {
    const previous = statuses.get(result.adapter);
    const rank = { live: 0, synthetic: 1, fallback: 2 } as const;
    if (!previous || rank[result.mode] > rank[previous.mode]) {
      statuses.set(result.adapter, { adapter: result.adapter, source: result.source, mode: result.mode, reason: result.reason });
    }
    return result.data;
  };

  const dates = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(request.startDate, i));
  const weekStart = zonedHourToUtc(dates[0], 0, city.timeZone);
  const weekEnd = zonedHourToUtc(addDays(dates[dates.length - 1], 1), 0, city.timeZone);

  // Qloo is required. Resolve first; stop if it is down.
  const resolved = track(await qloo.resolveArtists(request.performer.artists, adapters));
  if (statuses.get("qloo")?.mode === "fallback") throw new WeekQlooUnavailableError("Qloo is unavailable");
  const ids = resolved.flatMap((r) => (r.entity ? [r.entity.id] : []));

  const minHour = Math.min(...WEEK_SLOTS.map((s) => s.startHour));
  const maxHour = Math.max(...WEEK_SLOTS.map((s) => s.endHour));
  const [cells, places, typical, pitchData, events, weather] = await Promise.all([
    ids.length ? qloo.tasteMap(ids, city.bbox, adapters).then(track) : Promise.resolve([]),
    ids.length ? qloo.busyPlaces(ids, city.center, PLACES_RADIUS_M, null, adapters).then(track) : Promise.resolve([]),
    getTypicalFootfall(request.city, minHour, maxHour, adapters, today).then(track),
    getPitches(request.city, adapters).then(track),
    getEventsBetween(request.city, weekStart.toISOString(), weekEnd.toISOString(), adapters).then(track),
    getWeatherWeek(request.city, request.startDate, WEEK_DAYS, adapters, today).then(track),
  ]);
  if (statuses.get("qloo")?.mode === "fallback") throw new WeekQlooUnavailableError("Qloo is unavailable");
  if (cells.length === 0) notes.push("Qloo had no taste data for this area, so taste was left out of the scores.");

  const days: WeekDay[] = dates.map((date) => ({
    date,
    weekday: weekdayOf(date),
    slots: WEEK_SLOTS.map((slot) => ({
      ...slot,
      startMs: zonedHourToUtc(date, slot.startHour, city.timeZone).getTime(),
      endMs: zonedHourToUtc(date, slot.endHour, city.timeZone).getTime(),
    })),
  }));
  const weights = normalizeWeights(request.weights);
  // Candidate footpaths sit at sensors; their counts are applied per slot in scoreWeek.
  const sensorSpots = typical.sensors.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, avgHourly: null }));
  const candidates = buildCandidates(pitchData.sites, pitchData.zones, sensorSpots, request.permit);
  const grid = scoreWeek(candidates, { days, cells, sensors: typical.sensors, places, events, weather }, weights);
  // Slots that have already started can't be chosen.
  const startMs = (date: string, hour: number) => zonedHourToUtc(date, hour, city.timeZone).getTime();
  const isPast = (c: WeekCell) => startMs(c.date, c.startHour) <= now.getTime();
  const chosen = selectSessions(grid.filter((c) => !isPast(c)), request.limits);
  const chosenKeys = new Set(chosen.map((c) => sessionKey(c.date, c.startHour)));

  let ai: z.infer<typeof explanationSchema> | null = null;
  if (explain && chosen.length > 0) {
    if (!adapters.offline && !providerStatus().aiGateway) {
      notes.push("AI explanations are not configured here, so the reasons are generated from the data.");
    } else {
      try {
        const { output } = await generateText({
          model: adapters.offline ? createMockWeekExplainer() : MODELS.planner,
          output: Output.object({ schema: explanationSchema }),
          maxOutputTokens: 900,
          abortSignal: AbortSignal.timeout(45_000),
          system:
            "You explain a street performer's best busking sessions for the week. Use only the evidence given. Never invent numbers, places or events. Say 'estimate' for typical foot traffic and estimated event times. One or two sentences per session. Australian English.",
          prompt: JSON.stringify({
            performer: request.performer.name,
            soundsLike: request.performer.artists,
            sessions: chosen.map((c) => ({
              key: sessionKey(c.date, c.startHour),
              when: `${capitalise(c.weekday)} ${c.date}, ${formatHour(c.startHour)}–${formatHour(c.endHour)}`,
              pitch: c.best.name,
              score: c.best.score,
              factors: c.best.factors,
              typicalPeoplePerHour: c.best.evidence.sensor?.avgHourly ?? null,
              nearbyPlaces: c.best.evidence.places.slice(0, 3).map((p) => p.name),
              events: c.best.evidence.events.map((e) => ({ name: e.name, moment: e.moment, endEstimated: e.endEstimated })),
              cautions: c.best.cautions,
            })),
          }),
        });
        ai = output;
      } catch (error) {
        log.error("week explanation failed; using template", { error: error instanceof Error ? error.message : "unknown" });
        notes.push("The AI explainer was unavailable, so the reasons are generated from the data.");
      }
    }
  }
  const aiWhy = new Map((ai?.sessions ?? []).filter((s) => chosenKeys.has(s.key)).map((s) => [s.key, s.why.trim()]));

  const sessions: WeekSession[] = chosen.map((c) => {
    const key = sessionKey(c.date, c.startHour);
    const why = aiWhy.get(key);
    return {
      key,
      date: c.date,
      weekday: c.weekday,
      startHour: c.startHour,
      endHour: c.endHour,
      label: `${capitalise(c.weekday)} ${c.date}, ${formatHour(c.startHour)}–${formatHour(c.endHour)}`,
      score: c.best.score,
      pitch: { id: c.best.id, name: c.best.name, lat: c.best.lat, lon: c.best.lon, kind: c.best.kind, amplification: c.best.amplification, cautions: c.best.cautions },
      factors: c.best.factors,
      evidence: {
        typicalPerHour: c.best.evidence.sensor?.avgHourly ?? null,
        sensorName: c.best.evidence.sensor?.name ?? null,
        places: c.best.evidence.places.slice(0, 3).map((p) => p.name),
        events: c.best.evidence.events.map((e) => ({ name: e.name, moment: e.moment, endEstimated: e.endEstimated })),
      },
      why: why || templateSessionWhy(c),
      whySource: why ? "ai" : "template",
    };
  });
  const usedAi = sessions.some((s) => s.whySource === "ai");

  return weekPlanSchema.parse({
    version: 1,
    city: request.city,
    cityName: city.name,
    timeZone: city.timeZone,
    performerName: request.performer.name,
    permit: request.permit,
    startDate: request.startDate,
    days: dates.map((date) => ({ date, weekday: weekdayOf(date), label: `${capitalise(weekdayOf(date)).slice(0, 3)} ${date.slice(8)}`, hasForecast: Boolean(weather[date]) })),
    slots: WEEK_SLOTS.map((s) => ({ ...s, label: `${formatHour(s.startHour)}–${formatHour(s.endHour)}` })),
    grid: grid.map((c) => ({
      date: c.date,
      startHour: c.startHour,
      endHour: c.endHour,
      score: c.best?.score ?? null,
      pitchName: c.best?.name ?? null,
      unavailable: request.limits.unavailable.some((u) => u.date === c.date && u.startHour < c.endHour && u.endHour > c.startHour),
      chosen: chosenKeys.has(sessionKey(c.date, c.startHour)),
      past: isPast(c),
    })),
    sessions,
    limits: request.limits,
    explanations: usedAi ? "ai" : "template",
    summary:
      (usedAi && ai?.summary.trim()) ||
      (sessions.length > 0 ? `Best session: ${sessions[0].label} at ${sessions[0].pitch.name} (${sessions[0].score}/100).` : "No session could be recommended this week with the data available."),
    notes,
    qlooMode: adapters.offline || statuses.get("qloo")?.mode === "synthetic" ? "synthetic" : "live",
    qlooFailed: false,
    footfallLevel: typical.level,
    dataStatus: [...statuses.values()],
  });
}
