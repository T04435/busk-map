/**
 * Shared, client-safe schemas for plan requests, plans and the step stream.
 * The server validates every request and the final plan against these.
 */
import { z } from "zod";
import { slotSchema } from "./slot";
import { tipHistorySchema } from "./tips";

export const PERMITS = ["general", "premium", "circle-act"] as const;
export const CITY_IDS = ["melbourne"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);

/** A Spotify id: 22 base-62 characters. */
export const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/);

export const repertoireSongSchema = z.object({
  title: text(120),
  artist: text(80),
  own: z.boolean().default(false),
  /** Track length from Spotify, when the song was picked from search. */
  durationMs: z.number().int().positive().max(3_600_000).optional(),
});

export const weightsSchema = z
  .object({
    taste: z.number().min(0).max(1),
    footfall: z.number().min(0).max(1),
    places: z.number().min(0).max(1),
    events: z.number().min(0).max(1),
    weather: z.number().min(0).max(1),
    discovery: z.number().min(0).max(1),
  })
  .partial();

export const planRequestSchema = z.object({
  city: z.enum(CITY_IDS),
  slot: slotSchema,
  permit: z.enum(PERMITS).default("general"),
  performer: z.object({
    name: text(80),
    artists: z.array(text(80)).min(1).max(10),
    /** Spotify ids for artists picked from search: Qloo resolves these by id before trying the name. */
    spotifyArtists: z.array(z.object({ name: text(80), id: spotifyIdSchema })).max(10).default([]),
    songs: z.array(repertoireSongSchema).max(60).default([]),
  }),
  weights: weightsSchema.optional(),
  /** Summary of the performer's tip log (from this browser), for the personal bonus. */
  history: tipHistorySchema.optional(),
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

export const PITCH_KINDS = ["designated", "public-space", "footpath"] as const;
export const discoverySchema = z.enum(["hidden-gem", "usual"]).nullable();

export const tipBonusSchema = z.object({
  /** Points added to the score (0–5). */
  points: z.number().int().min(0).max(100),
  sessions: z.number().int(),
  perHour: z.number(),
  averagePerHour: z.number(),
  lift: z.number(),
});

export const planPitchSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  kind: z.enum(PITCH_KINDS),
  /** Why it was a candidate: a top Qloo taste cell, a council site, or the no-taste fallback. */
  origin: z.enum(["taste", "council", "fallback"]),
  /** Rank of the Qloo taste cell it came from (1 = the performer's strongest area). */
  cellRank: z.number().int().nullable(),
  discovery: discoverySchema,
  /** The well-known busking hotspot it sits at, if any. */
  usualSpot: z.string().nullable(),
  footfallSource: z.enum(["sensor", "nearby-sensors", "qloo-popularity"]).nullable(),
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
    discovery: z.number().min(0).max(1),
  }),
  why: z.string(),
  whySource: z.enum(["ai", "template"]),
  /** The personal bonus from the tip log (already in the score), when the log covers this pitch. */
  tip: tipBonusSchema.nullable().default(null),
  evidence: z.object({
    /** With footfallSource "nearby-sensors", avgHourly is the estimate and name the nearest sensor. */
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
      /** Track length, when known (songs picked from Spotify search). */
      durationMs: z.number().nullable().default(null),
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
  weights: z.object({ taste: z.number(), footfall: z.number(), places: z.number(), events: z.number(), weather: z.number(), discovery: z.number() }),
  pitches: z.array(planPitchSchema).max(3),
  others: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      lat: z.number(),
      lon: z.number(),
      score: z.number(),
      kind: z.enum(PITCH_KINDS),
      discovery: discoverySchema,
      tipPoints: z.number().int().nullable().default(null),
    }),
  ),
  /** The tip log behind the personal bonus, when one was used. */
  tipHistory: z.object({ source: z.enum(["example", "yours", "mixed"]), sessions: z.number().int(), perHour: z.number() }).nullable().default(null),
  /** How the data narrowed down to the pitches (see scoring/candidates.ts). */
  funnel: z
    .object({ cells: z.number().int(), topCells: z.number().int(), considered: z.number().int(), excluded: z.number().int(), candidates: z.number().int() })
    .nullable()
    .default(null),
  /** Qloo heatmap cells, affinity relative to the best cell; geohash for drawing the cell. */
  tasteCells: z.array(z.object({ lat: z.number(), lon: z.number(), affinity: z.number().min(0).max(1), geohash: z.string().nullable() })),
  crowd: z.object({
    localArtists: z.array(
      z.object({
        name: z.string(),
        affinity: z.number().nullable(),
        because: z.array(z.string()),
        /** Percentile points gained over the trending window (Qloo trending), when known. */
        trend: z.number().nullable().default(null),
      }),
    ),
    /** Genres that characterise the crowd at the top pitch (Qloo urn:tag). */
    genres: z.array(z.object({ name: z.string(), affinity: z.number().nullable() })).default([]),
    /** How the performer's fans differ from the crowd the city centre already likes (Qloo compare). */
    contrast: z.object({ hotspot: z.string(), more: z.array(z.string()), less: z.array(z.string()) }).nullable().default(null),
    /** Age and gender lean of the performer's fans (Qloo demographics); positive is above average. */
    demographics: z
      .object({ age: z.array(z.object({ band: z.string(), lean: z.number() })), gender: z.array(z.object({ band: z.string(), lean: z.number() })) })
      .nullable()
      .default(null),
    /** Which of the performer's artists drove the crowd's picks most (aggregate of explainability). */
    drivers: z.array(z.object({ name: z.string(), share: z.number() })).default([]),
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
