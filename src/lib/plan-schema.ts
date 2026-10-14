/**
 * Shared, client-safe schemas for plan requests, plans and the step stream.
 * The server validates every request and the final plan against these.
 */
import { z } from "zod";
import { slotSchema } from "./slot";

export const PERMITS = ["general", "premium", "circle-act"] as const;
export const CITY_IDS = ["melbourne"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);

export const repertoireSongSchema = z.object({
  title: text(120),
  artist: text(80),
  own: z.boolean().default(false),
});

export const weightsSchema = z
  .object({
    taste: z.number().min(0).max(1),
    footfall: z.number().min(0).max(1),
    places: z.number().min(0).max(1),
    events: z.number().min(0).max(1),
    weather: z.number().min(0).max(1),
  })
  .partial();

export const planRequestSchema = z.object({
  city: z.enum(CITY_IDS),
  slot: slotSchema,
  permit: z.enum(PERMITS).default("general"),
  performer: z.object({
    name: text(80),
    artists: z.array(text(80)).min(1).max(10),
    songs: z.array(repertoireSongSchema).max(60).default([]),
  }),
  weights: weightsSchema.optional(),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanRequestInput = z.input<typeof planRequestSchema>;

const adapterModes = z.enum(["live", "synthetic", "fallback"]);

export const dataStatusSchema = z.object({
  adapter: z.string(),
  source: z.string(),
  mode: adapterModes,
  reason: z.string().optional(),
});

const factorValue = z.number().min(0).max(1).nullable();

export const planPitchSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  kind: z.enum(["designated", "footpath"]),
  amplification: z.enum(["allowed", "unamplified-zone"]),
  rules: z.string(),
  rulesUrl: z.string().nullable(),
  cautions: z.array(z.string()),
  score: z.number().int().min(0).max(100),
  factors: z.object({
    taste: factorValue,
    footfall: factorValue,
    places: factorValue,
    events: factorValue,
    weatherPenalty: factorValue,
  }),
  why: z.string(),
  whySource: z.enum(["ai", "template"]),
  evidence: z.object({
    sensor: z.object({ name: z.string(), avgHourly: z.number() }).nullable(),
    places: z.array(z.object({ name: z.string(), distanceM: z.number(), popularity: z.number().nullable(), open: z.enum(["open", "unknown"]) })),
    events: z.array(
      z.object({
        name: z.string(),
        venue: z.string(),
        moment: z.enum(["arriving", "leaving"]),
        localTime: z.string().nullable(),
        endEstimated: z.boolean(),
        url: z.string().nullable(),
      }),
    ),
  }),
  setlist: z.array(
    z.object({
      songId: z.string(),
      title: z.string(),
      artist: z.string(),
      own: z.boolean(),
      score: z.number(),
      affinity: z.number(),
      affinitySource: z.enum(["qloo", "proxy"]),
      playcount: z.number().nullable(),
      reason: z.string(),
    }),
  ),
});

export const planSchema = z.object({
  version: z.literal(1),
  city: z.enum(CITY_IDS),
  cityName: z.string(),
  slot: slotSchema,
  slotLabel: z.string(),
  performerName: z.string(),
  permit: z.enum(PERMITS),
  qlooMode: z.enum(["live", "synthetic"]),
  explanations: z.enum(["ai", "template"]),
  summary: z.string(),
  notes: z.array(z.string()),
  weights: z.object({ taste: z.number(), footfall: z.number(), places: z.number(), events: z.number(), weather: z.number() }),
  pitches: z.array(planPitchSchema).max(3),
  others: z.array(z.object({ id: z.string(), name: z.string(), lat: z.number(), lon: z.number(), score: z.number(), kind: z.enum(["designated", "footpath"]) })),
  tasteCells: z.array(z.object({ lat: z.number(), lon: z.number(), affinity: z.number().min(0).max(1) })),
  crowd: z.object({
    localArtists: z.array(z.object({ name: z.string(), affinity: z.number().nullable(), because: z.array(z.string()) })),
  }),
  learnThese: z.array(
    z.object({
      artist: z.string(),
      title: z.string().nullable(),
      playcount: z.number().nullable(),
      reason: z.string(),
    }),
  ),
  weather: z
    .object({
      hours: z.array(z.object({ hour: z.number(), temperatureC: z.number().nullable(), precipitationProbability: z.number().nullable(), windKmh: z.number().nullable() })),
    })
    .nullable(),
  resolvedArtists: z.array(z.object({ query: z.string(), matched: z.string().nullable() })),
  dataStatus: z.array(dataStatusSchema),
  footfallLevel: z.enum(["city-sensors", "unavailable"]),
  rulesUrl: z.string(),
  /** Whether Qloo (required) failed: the plan is then unusable and the UI shows an error. */
  qlooFailed: z.boolean(),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanPitch = z.infer<typeof planPitchSchema>;
export type DataStatus = z.infer<typeof dataStatusSchema>;

/** Events streamed from /api/plan, one JSON object per line. */
export const planStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), message: z.string() }),
  z.object({ type: z.literal("tool-start"), id: z.string(), tool: z.string(), label: z.string() }),
  z.object({ type: z.literal("tool-end"), id: z.string(), tool: z.string(), ok: z.boolean(), summary: z.string() }),
  z.object({ type: z.literal("plan"), plan: planSchema }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export type PlanStreamEvent = z.infer<typeof planStreamEventSchema>;
