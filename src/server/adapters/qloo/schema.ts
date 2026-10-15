import { z } from "zod";

/**
 * Qloo hackathon API response schemas. Verified against live responses from
 * https://hackathon.api.qloo.com on 2026-10-15 (shapes only; see
 * docs/qloo-mock.md) and mirrored by the local mock (src/server/qloo-mock).
 * Still lenient (optional fields, unknown keys stripped), as Qloo adds fields.
 */

const num = z.number().finite();
/** Qloo sends some counts and ranks as strings ("50168"). */
const numeric = z.union([num, z.string().trim().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);
/** Some names arrive padded (" indie"). */
const name = z.string().transform((s) => s.trim());

/**
 * Entity tags: /search and /entities send `tag_id` (plus `value`), insights
 * results send `id`. Either is accepted; tags without one are dropped.
 */
const tagSchema = z
  .object({ id: z.string().optional(), tag_id: z.string().optional(), name: name.optional(), type: z.string().optional() })
  .transform((t) => ({ id: t.id ?? t.tag_id, name: t.name, type: t.type }));

const coordinates = z.object({ lat: num, lon: num });

export const entitySchema = z.object({
  entity_id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  types: z.array(z.string()).optional(),
  popularity: num.nullish(),
  location: z
    .object({ lat: num.optional(), lon: num.optional(), latitude: num.optional(), longitude: num.optional() })
    .optional(),
  properties: z
    .object({
      address: z.string().nullish(),
      geocode: z
        .object({ latitude: num.optional(), longitude: num.optional(), name: z.string().optional() })
        .loose()
        .optional(),
      hours: z.record(z.string(), z.unknown()).nullish(),
      /** Live places (2026-10-16): whether the venue has live music. */
      live_music: z.boolean().nullish(),
      /** Live places: what the venue is good for ("Pub", "Large Group"), with a weight. */
      good_for: z.array(z.object({ name: name.optional(), weight: num.nullish() }).loose()).nullish(),
      /** Live places: words from reviews with counts ("bands" 49, "live music" 23). */
      keywords: z.array(z.object({ name, count: numeric.optional() }).loose()).nullish(),
      description: z.unknown().optional(),
      /** Live /search and /entities: other services' ids; Last.fm adds listener counts. */
      external: z
        .object({ lastfm: z.object({ listeners: numeric.optional() }).loose().optional() })
        .loose()
        .optional(),
    })
    .loose()
    .optional(),
  /** Live places can send `tags: null`. */
  tags: z.array(tagSchema).nullish(),
  /** Insights results: other services' ids as lists; Last.fm entries carry listener counts. */
  external: z
    .object({ lastfm: z.array(z.object({ listeners: numeric.optional() }).loose()).optional() })
    .loose()
    .optional(),
  query: z
    .object({
      affinity: num.optional(),
      explainability: z.unknown().optional(),
      /** Live insights results (2026-10-16): `{audience_growth}`, 0 for every artist checked so far. */
      measurements: z.object({ audience_growth: numeric.optional() }).loose().optional(),
    })
    .loose()
    .optional(),
});

export type RawEntity = z.infer<typeof entitySchema>;

/** /search returns `results` as a list; /v2/insights nests `results.entities`. */
export const searchResponseSchema = z.object({
  results: z.union([z.array(z.unknown()), z.object({ entities: z.array(z.unknown()) }).transform((r) => r.entities)]),
});

export const entitiesResponseSchema = z.object({
  results: z.union([
    z.object({ entities: z.array(z.unknown()) }).transform((r) => r.entities),
    z.array(z.unknown()),
  ]),
});

export const heatmapResponseSchema = z.object({
  results: z.object({
    heatmap: z.array(
      z.object({
        location: z.object({ latitude: num, longitude: num, geohash: z.string().optional() }),
        query: z.object({ affinity: num, affinity_rank: num.optional(), popularity: num.optional() }),
      }),
    ),
  }),
});

export const demographicsResponseSchema = z.object({
  results: z.object({
    demographics: z.array(
      z.object({
        entity_id: z.string().optional(),
        query: z.object({
          age: z.record(z.string(), num).optional(),
          gender: z.record(z.string(), num).optional(),
        }),
      }),
    ),
  }),
});

export const trendingResponseSchema = z.object({
  results: z.object({
    trending: z.array(
      z
        .object({
          entity_id: z.string().optional(),
          date: z.string().optional(),
          /** A 0–1 fraction on live Qloo (not a percentage). */
          population_percentile: num.optional(),
          /** A string on live Qloo ("50168"). */
          population_rank: numeric.optional(),
          population_rank_velocity: numeric.optional(),
          velocity_fold_change: numeric.optional(),
          population_percent_delta: numeric.optional(),
        })
        .loose(),
    ),
  }),
});

/** `urn:tag` insights: `results.tags[]` with `tag_id` (docs: Taste Analysis). */
export const tagsResponseSchema = z.object({
  results: z.object({
    tags: z.array(
      z
        .object({
          tag_id: z.string().optional(),
          id: z.string().optional(),
          name,
          query: z.object({ affinity: num.optional() }).loose().optional(),
        })
        .loose(),
    ),
  }),
});

/**
 * `/v2/analysis/compare` (verified live 2026-10-15). `results.a` and
 * `results.b` list the tags of each group's entities, with `query.count` (a
 * string) = how many of the group's entities carry the tag; `results.tags`
 * is the shared tags with a similarity `query.score`. There is no per-group
 * affinity, and `filter.subtype` / `take` are ignored.
 */
const compareTag = z
  .object({
    tag_id: z.string(),
    name,
    subtype: z.string().optional(),
    query: z.object({ count: numeric.optional(), score: num.optional() }).loose().optional(),
  })
  .loose();

export const compareResponseSchema = z.object({
  results: z.object({
    tags: z.array(compareTag).default([]),
    a: z.array(compareTag).default([]),
    b: z.array(compareTag).default([]),
  }),
});

/**
 * Top-level `query.explainability` on /v2/insights with feature.explainability
 * (verified live): each input entity's average score across the top 3, 5, 10
 * and all results.
 */
const effect = z.array(z.object({ entity_id: z.string(), avg_score: num })).optional();
export const explainabilityAggregateSchema = z
  .object({
    "signal.interests.entities": z
      .object({ effect_on_top3_recs: effect, effect_on_top5_recs: effect, effect_on_top10_recs: effect, effect_on_all_recs: effect })
      .loose()
      .optional(),
  })
  .loose();

/** /v2/insights entities plus the optional top-level query block. */
export const insightsEntitiesResponseSchema = z.object({
  results: z.object({ entities: z.array(z.unknown()) }),
  query: z.object({ explainability: explainabilityAggregateSchema.optional() }).loose().optional(),
});

// ---- Domain types the rest of the app uses ------------------------------

export type Explanation = { entityId: string; name: string | null; score: number };

export type QlooEntity = {
  id: string;
  name: string;
  popularity: number | null;
  /** Last.fm listeners, when Qloo's /search or /entities carry them. */
  lastfmListeners: number | null;
  affinity: number | null;
  /** Qloo's audience_growth measurement (insights results), when sent. */
  audienceGrowth: number | null;
  tags: { id: string; name: string }[];
  /** Input entities that drove this result (feature.explainability). */
  explanation: Explanation[];
};

export type QlooPlace = QlooEntity & {
  lat: number;
  lon: number;
  address: string | null;
  /** Raw opening hours by day, when Qloo has them. */
  hours: Record<string, unknown> | null;
  /** Live music at the venue (Qloo), when known. */
  liveMusic: boolean | null;
  /** What the venue is good for (Qloo), strongest first. */
  goodFor: string[];
  /** The most mentioned review keywords (Qloo), most mentioned first. */
  keywords: string[];
};

export type HeatCell = {
  lat: number;
  lon: number;
  geohash: string | null;
  affinity: number;
  affinityRank: number | null;
  popularity: number | null;
};

export type TrendRow = {
  entityId: string;
  /** Week-over-week change in population percentile, in percent (positive means rising). */
  percentDelta: number | null;
  velocity: number | null;
  /** Population percentile, 0–100 (Qloo sends a 0–1 fraction). */
  percentile: number | null;
  /** Percentile points gained over the whole window (newest minus oldest week). */
  windowChange?: number | null;
  /** Weekly percentiles, oldest first. */
  series?: number[];
};

export type TasteTag = { id: string; name: string; affinity: number | null };

/** Share (0–1) of each group's artists tagged with this genre. */
export type GenreContrast = { id: string; name: string; a: number; b: number };

/** How much one input artist drove the results (top-level explainability), 0–1. */
export type Impact = { entityId: string; top3: number | null; top5: number | null; top10: number | null; all: number | null };

export type LocalArtists = { artists: QlooEntity[]; impact: Impact[] };

export type CrowdProfile = {
  age: Record<string, number>;
  gender: Record<string, number>;
};

export const coordinatesSchema = coordinates;
