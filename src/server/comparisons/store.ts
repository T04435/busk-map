import "server-only";
import { neon } from "@neondatabase/serverless";
import type { ComparisonRecord } from "@/server/scoring";
import { env } from "@/server/env";
import { log } from "@/server/log";

/**
 * Where plain-AI baseline comparisons are recorded, for the uniqueness stats
 * ("x of Busk Map's top-3 picks are places a plain AI didn't name"). Records
 * hold no personal data (see ComparisonRecord). Recording never blocks or
 * fails a plan.
 */
export type ComparisonStats = {
  runs: number;
  /** Busk Map top-3 picks across runs, and how many the plain AI didn't name. */
  picks: number;
  uniquePicks: number;
  /** uniquePicks / picks, 0–1 (null with no runs). */
  uniqueRate: number | null;
  averageOverlap: number | null;
  /** Busk Map's average pick score minus the plain AI's scored spots' average, over runs where any plain spot could be scored. */
  averageScoreDelta: number | null;
  runsWithScoredPlainSpots: number;
};

export interface ComparisonStore {
  readonly kind: "postgres" | "memory" | "none";
  record(record: ComparisonRecord): Promise<void>;
  stats(): Promise<ComparisonStats | null>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const averages = (r: ComparisonRecord) => {
  const scored = r.plain.flatMap((p) => (p.score === null ? [] : [p.score]));
  return { ours: mean(r.ours.map((p) => p.score)) ?? 0, plain: mean(scored) };
};

/** The aggregate, computed the same way as the SQL in PostgresComparisonStore. */
export function statsOf(records: ComparisonRecord[]): ComparisonStats {
  const picks = records.reduce((n, r) => n + r.ours.length, 0);
  const uniquePicks = records.reduce((n, r) => n + r.ours.filter((p) => !p.agreed).length, 0);
  const deltas = records.flatMap((r) => {
    const a = averages(r);
    return a.plain === null ? [] : [a.ours - a.plain];
  });
  return {
    runs: records.length,
    picks,
    uniquePicks,
    uniqueRate: picks === 0 ? null : uniquePicks / picks,
    averageOverlap: mean(records.map((r) => r.overlap)),
    averageScoreDelta: mean(deltas),
    runsWithScoredPlainSpots: deltas.length,
  };
}

/** Tests and offline mode: this instance's memory only. */
export class MemoryComparisonStore implements ComparisonStore {
  readonly kind = "memory" as const;
  readonly records: ComparisonRecord[] = [];
  async record(record: ComparisonRecord) {
    this.records.push(record);
  }
  async stats() {
    return statsOf(this.records);
  }
}

/** No database configured: recording is a no-op (said once in the log), and there are no stats. */
export class NoComparisonStore implements ComparisonStore {
  readonly kind = "none" as const;
  private warned = false;
  async record() {
    if (this.warned) return;
    this.warned = true;
    log.info("baseline comparisons are not recorded: DATABASE_URL is not set");
  }
  async stats() {
    return null;
  }
}

type Sql = ReturnType<typeof neon>;

/**
 * Postgres (Neon's serverless driver over HTTP, through the pooled
 * DATABASE_URL, so it suits functions). The table comes from
 * migrations/001_baseline_comparisons.sql, applied ahead of time over the
 * direct connection (pnpm db:migrate:dev); a missing table makes recording
 * fail softly (recordComparison) and stats unavailable.
 */
export class PostgresComparisonStore implements ComparisonStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async record(record: ComparisonRecord) {
    const a = averages(record);
    await this.sql.query(
      "INSERT INTO baseline_comparisons (performer_key, city, slot, overlap, ours, plain, our_avg, plain_avg) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)",
      [record.performerKey, record.city, record.slot, record.overlap, JSON.stringify(record.ours), JSON.stringify(record.plain), a.ours, a.plain],
    );
  }

  async stats(): Promise<ComparisonStats> {
    const rows = (await this.sql.query(
      `SELECT count(*)::int AS runs,
              coalesce(sum(jsonb_array_length(ours)), 0)::int AS picks,
              coalesce(sum((SELECT count(*) FROM jsonb_array_elements(ours) o WHERE NOT (o->>'agreed')::boolean)), 0)::int AS unique_picks,
              avg(overlap)::float AS average_overlap,
              avg(our_avg - plain_avg) FILTER (WHERE plain_avg IS NOT NULL)::float AS average_score_delta,
              count(*) FILTER (WHERE plain_avg IS NOT NULL)::int AS runs_with_scored
         FROM baseline_comparisons`,
    )) as { runs: number; picks: number; unique_picks: number; average_overlap: number | null; average_score_delta: number | null; runs_with_scored: number }[];
    const r = rows[0];
    return {
      runs: r.runs,
      picks: r.picks,
      uniquePicks: r.unique_picks,
      uniqueRate: r.picks === 0 ? null : r.unique_picks / r.picks,
      averageOverlap: r.average_overlap,
      averageScoreDelta: r.average_score_delta,
      runsWithScoredPlainSpots: r.runs_with_scored,
    };
  }
}

let store: ComparisonStore | null = null;

/** Offline (tests): memory. With DATABASE_URL: Postgres. Otherwise: none. */
export function comparisonStore(offline: boolean): ComparisonStore {
  if (offline) return (memoryStore ??= new MemoryComparisonStore());
  if (store) return store;
  const url = env().DATABASE_URL;
  store = url ? new PostgresComparisonStore(neon(url)) : new NoComparisonStore();
  return store;
}
let memoryStore: MemoryComparisonStore | null = null;

/** Record without ever failing the caller. */
export async function recordComparison(target: ComparisonStore, record: ComparisonRecord): Promise<void> {
  try {
    await target.record(record);
  } catch (error) {
    log.warn("baseline comparison not recorded", { store: target.kind, error: error instanceof Error ? error.message : "unknown" });
  }
}

export function resetComparisonStoresForTests() {
  store = null;
  memoryStore = null;
}
