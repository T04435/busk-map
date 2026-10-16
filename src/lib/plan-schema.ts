/**
 * Shared, client-safe schemas for plan requests, plans and the step stream.
 * The server validates every request and the final plan against these.
 */
import { z } from "zod";
import { slotSchema } from "./slot";
import { researchTotalsSchema } from "./research-totals";

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

export const planPitchSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  kind: z.enum(PITCH_KINDS),
  /** Why it was a candidate: a top Qloo taste cell, a council site, the no-taste fallback, Claude's check, or a well-known hotspot. */
  origin: z.enum(["taste", "council", "fallback", "agent", "hotspot"]),
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
  evidence: z.object({
    /** With footfallSource "nearby-sensors", avgHourly is the estimate and name the nearest sensor. */
    sensor: z.object({ name: z.string(), avgHourly: z.number() }).nullable(),
    places: z.array(
      z.object({
        name: z.string(),
        distanceM: z.number(),
        popularity: z.number().nullable(),
        open: z.enum(["open", "unknown"]),
        /** Venue detail from Qloo (live_music, good_for, review keywords). */
        liveMusic: z.boolean().nullable().default(null),
        goodFor: z.array(z.string()).default([]),
        keywords: z.array(z.string()).default([]),
      }),
    ),
    events: z.array(
      z.object({
        name: z.string(),
        venue: z.string(),
        moment: z.enum(["arriving", "leaving"]),
        localTime: z.string().nullable(),
        endEstimated: z.boolean(),
        url: z.string().nullable(),
        /** How close the event crowd's taste is to yours: Qloo affinity of its headliner given your artists. */
        tasteMatch: z.object({ artist: z.string(), affinity: z.number() }).nullable().default(null),
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
      /** First release year (Spotify), when known. */
      year: z.number().int().nullable().default(null),
      /** 0–1 fit of the song's era with the crowd's age lean (Qloo demographics), when known. */
      eraFit: z.number().min(0).max(1).nullable().default(null),
    }),
  ),
});

/** A pitch in the "Agent vs engine" line: its engine rank (null: added by Claude, outside the engine's own pool). */
const rankedPitchSchema = z.object({ id: z.string(), name: z.string(), score: z.number(), engineRank: z.number().int().nullable() });

/** One position where Claude's top 3 differs from the engine's. */
export const agentChangeSchema = z.object({
  position: z.number().int().min(1),
  pick: rankedPitchSchema,
  /** The engine's pick for that position; null when the engine had fewer pitches. */
  over: rankedPitchSchema.nullable(),
  reason: z.string(),
});

export type AgentChange = z.infer<typeof agentChangeSchema>;

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
  /** Which model wrote the "ai" explanations: Claude, or the offline mock model. Null for template text and older plans. */
  explanationsModel: z.enum(["claude", "mock"]).nullable().default(null),
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
      /** Ranked above one of the picks but left out: it lies within 250 m of this pick (the top-3 spacing rule). */
      tooCloseTo: z.object({ id: z.string(), name: z.string() }).nullable().default(null),
    }),
  ),
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
        /** The same, with Qloo's explainability score for each (0–1): the evidence behind "because". */
        explained: z.array(z.object({ name: z.string(), score: z.number() })).default([]),
        /** Percentile points gained over the trending window (Qloo trending), when known. */
        trend: z.number().nullable().default(null),
      }),
    ),
    /** What the crowd at the busiest busking hotspot likes with no performer signal (Qloo insights): "the usual crowd". */
    usualCrowd: z.object({ hotspot: z.string(), artists: z.array(z.object({ name: z.string(), affinity: z.number().nullable() })) }).nullable().default(null),
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
      /** Qloo's audience_growth for the artist with this crowd, when known. */
      audienceGrowth: z.number().nullable().default(null),
    }),
  ),
  /** The crowd's most over-represented age band (Qloo demographics), used for era matching. */
  ageLean: z.string().nullable().default(null),
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
  /**
   * When Claude's answer was used: the engine's own top 3, whether Claude's top 3 differs (set or order),
   * spots it added, and each position where Claude's pick isn't the engine's (with the reason from its why).
   */
  agent: z
    .object({
      engineTop: z.array(z.object({ id: z.string(), name: z.string(), score: z.number() })),
      differs: z.boolean(),
      added: z.array(z.string()),
      changes: z.array(agentChangeSchema).default([]),
    })
    .nullable()
    .default(null),
  /**
   * How much data the research used (the ResearchFunnel), computed when the plan was assembled and kept with it,
   * so it survives the 7-day strip of raw step data. Optional: plans stored before it still parse.
   * Definitions in lib/research-totals.ts.
   */
  researchTotals: researchTotalsSchema.optional(),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanPitch = z.infer<typeof planPitchSchema>;
export type DataStatus = z.infer<typeof dataStatusSchema>;

/**
 * The stream events the plan and the learn run share, field for field (docs/playlist-architecture.md §2.7, §7.1).
 * Exported by name so the learn stream reuses them; the plan stream's wire is unchanged.
 */
// `replay`: the run already finished and is being replayed from the cache (no new model call).
export const streamStatusSchema = z.object({ type: z.literal("status"), message: z.string(), replay: z.boolean().optional() });
/** Claude's words between tool calls: a reasoning summary (extended thinking) or the sentence it writes before a call. */
export const streamNoteSchema = z.object({ type: z.literal("note"), kind: z.enum(["reasoning", "text"]), text: z.string() });
/** `input`: the inputs Claude chose. */
export const streamToolStartSchema = z.object({ type: z.literal("tool-start"), id: z.string(), tool: z.string(), label: z.string(), source: z.string().optional(), input: z.unknown().optional() });
/** `output`: the data the tool returned, exactly as the model saw it. */
export const streamToolEndSchema = z.object({ type: z.literal("tool-end"), id: z.string(), tool: z.string(), ok: z.boolean(), summary: z.string(), output: z.unknown().optional() });
/** Run totals, sent before the plan. */
export const streamUsageSchema = z.object({
  type: z.literal("usage"),
  steps: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  reasoningTokens: z.number().int(),
  ms: z.number().int(),
  stoppedBy: z.string(),
});

/** Events streamed from /api/plan, one JSON object per line. */
export const planStreamEventSchema = z.discriminatedUnion("type", [
  streamStatusSchema,
  streamNoteSchema,
  streamToolStartSchema,
  streamToolEndSchema,
  streamUsageSchema,
  /**
   * Running research totals (the ResearchFunnel): sent after each tool-end, counted over the finished tool calls so far
   * (lib/research-totals.ts), and once more before the plan with the plan's own researchTotals.
   */
  z.object({ type: z.literal("totals"), totals: researchTotalsSchema }),
  z.object({ type: z.literal("plan"), plan: planSchema }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export type PlanStreamEvent = z.infer<typeof planStreamEventSchema>;

/** The plain-AI baseline set against the plan (POST /api/compare). The baseline never changes a score. */
export const baselineViewSchema = z.object({
  model: z.string(),
  setlist: z.array(z.string()),
  /** Busk Map's top pitches the plain AI also named. */
  bothAgree: z.array(z.object({ pitchId: z.string(), plainName: z.string() })),
  /** Busk Map's top pitch ids the plain AI didn't name. */
  onlyBuskMap: z.array(z.string()),
  plain: z.array(
    z.object({
      name: z.string(),
      why: z.string(),
      usualSpot: z.string().nullable(),
      status: z.enum(["ours", "scored", "not-legal", "no-data"]),
      locatedBy: z.enum(["name", "coordinates"]).nullable(),
      place: z.string().nullable(),
      pitchId: z.string().nullable(),
      pitchName: z.string().nullable(),
      score: z.number().nullable(),
      beatsOurs: z.boolean(),
      /** When it beats a pick: the Busk Map pick it lies within 250 m of, so the plan chose a spot further away. */
      tooCloseTo: z.string().nullable().default(null),
    }),
  ),
});

export type BaselineView = z.infer<typeof baselineViewSchema>;
