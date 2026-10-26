/**
 * Client-safe schemas for "Plan my week" (V2 plan phase 4): ONE run of the Hive over the next 7 days picks the best pitch
 * for each day you can play, or says a day isn't worth it. Each picked day is stored as a normal busk plan (/p/<id>); the
 * week's own record (/w/<id>) lists the seven days and keeps the run's steps for its replay.
 */
import { z } from "zod";
import { cityPlaceSchema, citySlugSchema, DEFAULT_CITY_ID } from "./city";
import { dataStatusSchema, PERMITS, planRequestSchema, streamNoteSchema, streamStatusSchema, streamToolEndSchema, streamToolStartSchema, streamUsageSchema, weightsSchema } from "./plan-schema";
import { researchTotalsSchema } from "./research-totals";
import { addDays, anyTimeSlotSchema, anyTimeWindowsLeft, slotSchema } from "./slot";

export const WEEK_DAYS = 7;

const isoDate = z.iso.date();

/** One day of the week: picked hours, any time (the Hive picks the hours; the default), or "Can't play". */
export const weekDayInputSchema = z.union([slotSchema, anyTimeSlotSchema, z.object({ date: isoDate, off: z.literal(true) })]);
export type WeekDayInput = z.infer<typeof weekDayInputSchema>;

export const isOffDay = (day: WeekDayInput): day is { date: string; off: true } => "off" in day && day.off === true;
export const isAnyTimeDay = (day: WeekDayInput): day is { date: string; any: true } => "any" in day && day.any === true;

export const weekRequestSchema = z
  .object({
    /** The city, as a busk names it (lib/city.ts): Melbourne carries no place, any other city its geocoded place. */
    city: citySlugSchema.default(DEFAULT_CITY_ID),
    place: cityPlaceSchema.optional(),
    permit: z.enum(PERMITS).default("general"),
    performer: planRequestSchema.shape.performer,
    startDate: isoDate,
    days: z.array(weekDayInputSchema).length(WEEK_DAYS),
    weights: weightsSchema.optional(),
  })
  .superRefine((week, ctx) => {
    if (week.city === DEFAULT_CITY_ID ? week.place !== undefined : week.place === undefined) ctx.addIssue({ code: "custom", path: ["place"], message: "Pick the city from the list." });
    week.days.forEach((day, i) => {
      if (day.date !== addDays(week.startDate, i)) ctx.addIssue({ code: "custom", path: ["days", i, "date"], message: "Days must be the 7 days from the start date, in order." });
    });
    if (week.days.every(isOffDay)) ctx.addIssue({ code: "custom", path: ["days"], message: "Pick at least one day you can play." });
  });

export type WeekRequest = z.infer<typeof weekRequestSchema>;
export type WeekRequestInput = z.input<typeof weekRequestSchema>;

/**
 * A day's status: pending (the run is still going), ready (playing: the Hive's pick, stored as a plan), not-worth (the Hive
 * judged the day not worth busking; it shows the reason), cant-play (you said so, or its hours have passed), failed.
 */
export const WEEK_DAY_STATUSES = ["pending", "ready", "not-worth", "cant-play", "failed"] as const;
export type WeekDayStatus = (typeof WEEK_DAY_STATUSES)[number];

export const weekDayResultSchema = z.object({
  date: isoDate,
  weekday: z.string(),
  /** "Sat 25 Oct". */
  label: z.string(),
  status: z.enum(WEEK_DAY_STATUSES),
  /** The hours: picked, or (any time) the window the Hive's pitch scored best in; null while pending or not planned. */
  slot: z.object({ startHour: z.number().int(), endHour: z.number().int() }).nullable(),
  /** "6 pm–9 pm", or "Any time" for an any-time day without hours yet. */
  window: z.string().nullable(),
  /** The day was asked for as any time (the Hive picks the hours). */
  anyTime: z.boolean(),
  /** The day's own busk plan (/p/<id>), when ready and stored. */
  planId: z.string().nullable(),
  pitch: z
    .object({
      id: z.string(),
      name: z.string(),
      lat: z.number(),
      lon: z.number(),
      score: z.number(),
      discovery: z.enum(["hidden-gem", "usual"]).nullable(),
      why: z.string(),
    })
    .nullable(),
  /** not-worth: the Hive's reason; cant-play: why (hours passed), else null; failed: what went wrong. */
  reason: z.string().nullable(),
});
export type WeekDayResult = z.infer<typeof weekDayResultSchema>;

export const weekUsageSchema = z.object({
  steps: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  reasoningTokens: z.number().int(),
  ms: z.number().int(),
});
export type WeekUsage = z.infer<typeof weekUsageSchema>;

export const weekResultSchema = z.object({
  version: z.literal(3),
  /** The week's own record (/w/<id>); null when it couldn't be stored. */
  id: z.string().nullable(),
  /** running: the Hive is still researching; done: the days are final; failed: the run ended with an error. */
  status: z.enum(["running", "done", "failed"]),
  city: z.string(),
  cityName: z.string(),
  timeZone: z.string(),
  /** Whether the city's busking rules are checked (Melbourne): elsewhere no permit is named. */
  rulesChecked: z.boolean(),
  permit: z.enum(PERMITS),
  performerName: z.string(),
  artists: z.array(z.string()),
  startDate: isoDate,
  /** The Hive's two sentences on the week, when it finished. */
  summary: z.string().nullable(),
  days: z.array(weekDayResultSchema).length(WEEK_DAYS),
  notes: z.array(z.string()),
  qlooMode: z.enum(["live", "synthetic"]),
  /** Which model wrote the words: Claude, or the offline mock model; null before the run finishes. */
  explanationsModel: z.enum(["claude", "mock"]).nullable(),
  researchTotals: researchTotalsSchema.nullable(),
  usage: weekUsageSchema.nullable(),
  dataStatus: z.array(dataStatusSchema),
  /** Why a failed run ended. */
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type WeekResult = z.infer<typeof weekResultSchema>;

/** The run's step events, as the plan stream sends them: the week's replay is these. */
export const weekStepEventSchema = z.discriminatedUnion("type", [
  streamStatusSchema,
  streamNoteSchema,
  streamToolStartSchema,
  streamToolEndSchema,
  streamUsageSchema,
  z.object({ type: z.literal("totals"), totals: researchTotalsSchema }),
]);
export type WeekStepEvent = z.infer<typeof weekStepEventSchema>;

/**
 * Events streamed from POST /api/week, one JSON object per line: `week-started` first (the week's id and its days, pending
 * or can't play), then the Hive's steps, ending with the final `week` or an `error`.
 */
export const weekStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("week-started"), week: weekResultSchema }),
  streamStatusSchema,
  streamNoteSchema,
  streamToolStartSchema,
  streamToolEndSchema,
  streamUsageSchema,
  z.object({ type: z.literal("totals"), totals: researchTotalsSchema }),
  z.object({ type: z.literal("week"), week: weekResultSchema }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type WeekStreamEvent = z.infer<typeof weekStreamEventSchema>;

/** A week's own page. */
export const weekPath = (id: string) => `/w/${id}`;

/** "Sat 17 Oct" (read in UTC, so it never shifts with the viewer's zone). */
export const weekDayLabel = (date: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** The 7 days from `start`, all any time (the default). */
export function defaultDays(start: string): WeekDayInput[] {
  return Array.from({ length: WEEK_DAYS }, (_, i) => ({ date: addDays(start, i), any: true as const }));
}

/** Where a new week starts by default: today while a 3-hour window can still start (city time), else tomorrow. */
export function defaultWeekStart(today: string, nowHour: number): string {
  return anyTimeWindowsLeft(today, today, nowHour).length > 0 ? today : addDays(today, 1);
}
