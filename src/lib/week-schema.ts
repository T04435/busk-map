/** Shared, client-safe schemas for the week planner. */
import { z } from "zod";
import { CITY_IDS, dataStatusSchema, PERMITS, planRequestSchema, weightsSchema } from "./plan-schema";

const isoDate = z.iso.date();

export const unavailableSchema = z.object({
  date: isoDate,
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
});

export const weekRequestSchema = z.object({
  city: z.enum(CITY_IDS),
  permit: z.enum(PERMITS).default("general"),
  performer: planRequestSchema.shape.performer,
  startDate: isoDate,
  limits: z
    .object({
      maxSessions: z.number().int().min(1).max(5).default(5),
      maxPerDay: z.number().int().min(1).max(4).default(1),
      unavailable: z.array(unavailableSchema).max(28).default([]),
    })
    .prefault({}),
  weights: weightsSchema.optional(),
});

export type WeekRequest = z.infer<typeof weekRequestSchema>;

const factor = z.number().min(0).max(1).nullable();

export const weekSessionSchema = z.object({
  key: z.string(),
  date: isoDate,
  weekday: z.string(),
  startHour: z.number().int(),
  endHour: z.number().int(),
  label: z.string(),
  score: z.number().int().min(0).max(100),
  pitch: z.object({
    id: z.string(),
    name: z.string(),
    lat: z.number(),
    lon: z.number(),
    kind: z.enum(["designated", "public-space", "footpath"]),
    discovery: z.enum(["hidden-gem", "usual"]).nullable(),
    amplification: z.enum(["allowed", "unamplified-zone"]),
    cautions: z.array(z.string()),
  }),
  factors: z.object({ taste: factor, footfall: factor, places: factor, events: factor, weatherPenalty: factor, discovery: z.number().min(0).max(1) }),
  evidence: z.object({
    typicalPerHour: z.number().nullable(),
    sensorName: z.string().nullable(),
    places: z.array(z.string()),
    events: z.array(z.object({ name: z.string(), moment: z.enum(["arriving", "leaving"]), endEstimated: z.boolean() })),
  }),
  why: z.string(),
  whySource: z.enum(["ai", "template"]),
});

export const weekPlanSchema = z.object({
  version: z.literal(1),
  city: z.enum(CITY_IDS),
  cityName: z.string(),
  timeZone: z.string(),
  performerName: z.string(),
  permit: z.enum(PERMITS),
  startDate: isoDate,
  days: z.array(
    z.object({
      date: isoDate,
      weekday: z.string(),
      label: z.string(),
      hasForecast: z.boolean(),
      /** What makes this day different: foot traffic, events and weather, in plain words. */
      drivers: z.array(z.string()).default([]),
      /** Typical foot traffic over the day relative to the week's busiest day (0–1), when sensors are available. */
      busyness: z.number().min(0).max(1).nullable().default(null),
    }),
  ),
  slots: z.array(z.object({ startHour: z.number().int(), endHour: z.number().int(), label: z.string() })),
  grid: z.array(
    z.object({
      date: isoDate,
      startHour: z.number().int(),
      endHour: z.number().int(),
      score: z.number().int().nullable(),
      pitchName: z.string().nullable(),
      unavailable: z.boolean(),
      chosen: z.boolean(),
      /** The slot has already started. */
      past: z.boolean(),
      /** Why this slot stands out: an event crowd nearby, rain risk, or peak foot traffic. */
      flags: z.array(z.enum(["event", "rain", "busy"])).default([]),
    }),
  ),
  sessions: z.array(weekSessionSchema).max(5),
  limits: z.object({ maxSessions: z.number().int(), maxPerDay: z.number().int(), unavailable: z.array(unavailableSchema) }),
  explanations: z.enum(["ai", "template"]),
  summary: z.string(),
  notes: z.array(z.string()),
  qlooMode: z.enum(["live", "synthetic"]),
  qlooFailed: z.boolean(),
  footfallLevel: z.enum(["city-sensors", "unavailable"]),
  dataStatus: z.array(dataStatusSchema),
});

export type WeekPlan = z.infer<typeof weekPlanSchema>;
export type WeekSession = z.infer<typeof weekSessionSchema>;
