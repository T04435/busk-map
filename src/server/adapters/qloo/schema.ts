import { z } from "zod";

/**
 * Qloo hackathon API response schemas, shaped from docs.qloo.com (checked
 * 2026-10-15) and exercised against the local mock (src/server/qloo-mock).
 * The key has not arrived yet, so these are deliberately lenient (optional
 * fields, unknown keys stripped) and MUST be re-checked against live
 * responses the day the key arrives.
 */

const num = z.number().finite();

const tagSchema = z.object({ id: z.string(), name: z.string().optional(), type: z.string().optional() });

const coordinates = z.object({ lat: num, lon: num });

export const entitySchema = z.object({
  entity_id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  types: z.array(z.string()).optional(),
  popularity: num.optional(),
  location: z
    .object({ lat: num.optional(), lon: num.optional(), latitude: num.optional(), longitude: num.optional() })
    .optional(),
  properties: z
    .object({
      address: z.string().optional(),
      geocode: z
        .object({ latitude: num.optional(), longitude: num.optional(), name: z.string().optional() })
        .loose()
        .optional(),
      hours: z.record(z.string(), z.unknown()).optional(),
      description: z.string().optional(),
    })
    .loose()
    .optional(),
  tags: z.array(tagSchema).optional(),
  query: z
    .object({
      affinity: num.optional(),
      explainability: z.unknown().optional(),
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
          population_percentile: num.optional(),
          population_rank: num.optional(),
          population_rank_velocity: num.optional(),
          velocity_fold_change: num.optional(),
          population_percent_delta: num.optional(),
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
          name: z.string(),
          query: z.object({ affinity: num.optional() }).loose().optional(),
        })
        .loose(),
    ),
  }),
});

/**
 * `/v2/analysis/compare`. The docs give no example; accept `results` as a list
 * or as `{ tags }`, with per-group affinities under `query.a` / `query.b`.
 */
const compareRow = z
  .object({
    tag_id: z.string().optional(),
    id: z.string().optional(),
    name: z.string(),
    query: z
      .object({ a: z.object({ affinity: num.optional() }).loose().optional(), b: z.object({ affinity: num.optional() }).loose().optional() })
      .loose()
      .optional(),
  })
  .loose();

export const compareResponseSchema = z.object({
  results: z.union([z.array(compareRow), z.object({ tags: z.array(compareRow) }).transform((r) => r.tags)]),
});

// ---- Domain types the rest of the app uses ------------------------------

export type Explanation = { entityId: string; name: string | null; score: number };

export type QlooEntity = {
  id: string;
  name: string;
  popularity: number | null;
  affinity: number | null;
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
  percentile: number | null;
  /** Percentile points gained over the whole window (newest minus oldest week). */
  windowChange?: number | null;
  /** Weekly percentiles, oldest first. */
  series?: number[];
};

export type TasteTag = { id: string; name: string; affinity: number | null };

export type GenreContrast = { id: string; name: string; a: number; b: number };

export type CrowdProfile = {
  age: Record<string, number>;
  gender: Record<string, number>;
};

export const coordinatesSchema = coordinates;
