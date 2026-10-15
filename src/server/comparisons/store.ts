import "server-only";
import { neon } from "@neondatabase/serverless";
import type { ComparisonRecord } from "@/server/scoring";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";

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
  /** Agent v2 against the engine alone: runs with Claude's accepted answer. */
  agentRuns: number;
  /** Runs where Claude's top 3 isn't the engine's top 3: a different set or a different order (the divergence). */
  agentDiffersRuns: number;
  /** agentDiffersRuns / agentRuns, 0–1 (null with no agent runs): the divergence rate. */
  agentDiffersRate: number | null;
  /** Runs where Claude's set differs (a pick outside the engine's top 3); the rest of agentDiffersRuns only reorder. */
  agentDifferentSetRuns: number;
  /** Positions (of 3) where Claude's pick isn't the engine's pick there, averaged over agent runs. */
  averagePositionsChanged: number | null;
  /** Claude's picks outside the engine's top 3, over all Claude's picks. */
  agentPicks: number;
  agentDifferentPicks: number;
  /** Claude's average pick score minus the engine's top-3 average (engine scores both), over agent runs. */
  averageAgentScoreDelta: number | null;
};

/**
 * One Agent v2 run, recorded next to the baseline row of the same plan
 * (run key). Ids and engine scores only.
 */
export type AgentRecord = {
  runKey: string;
  performerKey: string;
  city: string;
  slot: string;
  engineTop: { pitchId: string; score: number }[];
  agentTop: { pitchId: string; score: number; inEngineTop: boolean }[];
};

export function agentRecord(runKey: string, performerKey: string, city: string, slot: string, engineTop: { id: string; score: number }[], agentTop: { id: string; score: number }[]): AgentRecord {
  const engineIds = new Set(engineTop.map((p) => p.id));
  return {
    runKey,
    performerKey,
    city,
    slot,
    engineTop: engineTop.map((p) => ({ pitchId: p.id, score: p.score })),
    agentTop: agentTop.map((p) => ({ pitchId: p.id, score: p.score, inEngineTop: engineIds.has(p.id) })),
  };
}

/** Positions where Claude's pick isn't the engine's pick at that position. */
export const positionsChanged = (r: Pick<AgentRecord, "engineTop" | "agentTop">) =>
  Math.max(r.agentTop.length, r.engineTop.length) - r.agentTop.filter((p, i) => r.engineTop[i]?.pitchId === p.pitchId).length;
const differentSet = (r: AgentRecord) => r.agentTop.some((p) => !p.inEngineTop) || r.agentTop.length !== r.engineTop.length;
/** The divergence: a different set or a different order. */
export const agentDiffers = (r: AgentRecord) => positionsChanged(r) > 0;

export interface ComparisonStore {
  readonly kind: "postgres" | "memory" | "none";
  /** A baseline comparison; with a run key, it fills that plan's row (upsert). */
  record(record: ComparisonRecord, runKey?: string): Promise<void>;
  /** Claude's top 3 against the engine's, on the plan's row. */
  recordAgent(record: AgentRecord): Promise<void>;
  stats(): Promise<ComparisonStats | null>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const averages = (r: ComparisonRecord) => {
  const scored = r.plain.flatMap((p) => (p.score === null ? [] : [p.score]));
  return { ours: mean(r.ours.map((p) => p.score)) ?? 0, plain: mean(scored) };
};

type AgentStats = Pick<
  ComparisonStats,
  "agentRuns" | "agentDiffersRuns" | "agentDiffersRate" | "agentDifferentSetRuns" | "averagePositionsChanged" | "agentPicks" | "agentDifferentPicks" | "averageAgentScoreDelta"
>;

/** Agent v2 against the engine, from the recorded top 3s (both stores compute it here). */
export function agentStatsOf(agents: Pick<AgentRecord, "engineTop" | "agentTop">[]): AgentStats {
  const records = agents.map((r) => ({ ...r, runKey: "", performerKey: "", city: "", slot: "" }));
  const differs = records.filter(agentDiffers).length;
  return {
    agentRuns: records.length,
    agentDiffersRuns: differs,
    agentDiffersRate: records.length === 0 ? null : differs / records.length,
    agentDifferentSetRuns: records.filter(differentSet).length,
    averagePositionsChanged: mean(records.map(positionsChanged)),
    agentPicks: records.reduce((n, r) => n + r.agentTop.length, 0),
    agentDifferentPicks: records.reduce((n, r) => n + r.agentTop.filter((p) => !p.inEngineTop).length, 0),
    averageAgentScoreDelta: mean(records.map((r) => (mean(r.agentTop.map((p) => p.score)) ?? 0) - (mean(r.engineTop.map((p) => p.score)) ?? 0))),
  };
}

/** The aggregate, computed the same way as the SQL in PostgresComparisonStore. */
export function statsOf(records: ComparisonRecord[], agents: AgentRecord[] = []): ComparisonStats {
  const agentStats = agentStatsOf(agents);
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
    ...agentStats,
  };
}

/** Tests and offline mode: this instance's memory only. */
export class MemoryComparisonStore implements ComparisonStore {
  readonly kind = "memory" as const;
  readonly records: ComparisonRecord[] = [];
  readonly agents: AgentRecord[] = [];
  private readonly byRunKey = new Map<string, number>();
  async record(record: ComparisonRecord, runKey?: string) {
    const at = runKey === undefined ? undefined : this.byRunKey.get(runKey);
    if (at !== undefined) this.records[at] = record;
    else {
      this.records.push(record);
      if (runKey !== undefined) this.byRunKey.set(runKey, this.records.length - 1);
    }
  }
  async recordAgent(record: AgentRecord) {
    const at = this.agents.findIndex((a) => a.runKey === record.runKey);
    if (at === -1) this.agents.push(record);
    else this.agents[at] = record;
  }
  async stats() {
    return statsOf(this.records, this.agents);
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
  async recordAgent() {
    await this.record();
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

  async record(record: ComparisonRecord, runKey?: string) {
    const a = averages(record);
    await this.sql.query(
      `INSERT INTO baseline_comparisons (performer_key, city, slot, overlap, ours, plain, our_avg, plain_avg, run_key) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
       ON CONFLICT (run_key) DO UPDATE SET overlap = EXCLUDED.overlap, ours = EXCLUDED.ours, plain = EXCLUDED.plain, our_avg = EXCLUDED.our_avg, plain_avg = EXCLUDED.plain_avg,
         performer_key = EXCLUDED.performer_key, city = EXCLUDED.city, slot = EXCLUDED.slot`,
      [record.performerKey, record.city, record.slot, record.overlap, JSON.stringify(record.ours), JSON.stringify(record.plain), a.ours, a.plain, runKey ?? null],
    );
  }

  async recordAgent(record: AgentRecord) {
    const agentAvg = mean(record.agentTop.map((p) => p.score));
    const engineAvg = mean(record.engineTop.map((p) => p.score));
    await this.sql.query(
      `INSERT INTO baseline_comparisons (performer_key, city, slot, run_key, agent, agent_avg, agent_engine_avg, agent_differs) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       ON CONFLICT (run_key) DO UPDATE SET agent = EXCLUDED.agent, agent_avg = EXCLUDED.agent_avg, agent_engine_avg = EXCLUDED.agent_engine_avg, agent_differs = EXCLUDED.agent_differs`,
      [record.performerKey, record.city, record.slot, record.runKey, JSON.stringify({ engineTop: record.engineTop, agentTop: record.agentTop }), agentAvg, engineAvg, agentDiffers(record)],
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
         FROM baseline_comparisons WHERE ours IS NOT NULL`,
    )) as { runs: number; picks: number; unique_picks: number; average_overlap: number | null; average_score_delta: number | null; runs_with_scored: number }[];
    // The agent part is computed from the recorded top 3s (ids and engine scores only; one row per plan).
    const agentRows = (await this.sql.query(`SELECT agent FROM baseline_comparisons WHERE agent IS NOT NULL`)) as { agent: Pick<AgentRecord, "engineTop" | "agentTop"> }[];
    const r = rows[0];
    return {
      runs: r.runs,
      picks: r.picks,
      uniquePicks: r.unique_picks,
      uniqueRate: r.picks === 0 ? null : r.unique_picks / r.picks,
      averageOverlap: r.average_overlap,
      averageScoreDelta: r.average_score_delta,
      runsWithScoredPlainSpots: r.runs_with_scored,
      ...agentStatsOf(agentRows.map((row) => row.agent)),
    };
  }
}

const stores = processMap<"db" | "memory", ComparisonStore>("comparison-stores");

/** Offline (tests): memory. With DATABASE_URL (pooled): Postgres. Otherwise: none. One of each per process. */
export function comparisonStore(offline: boolean): ComparisonStore {
  const kind = offline ? "memory" : "db";
  let store = stores.get(kind);
  if (!store) {
    const url = env().DATABASE_URL;
    store = offline ? new MemoryComparisonStore() : url ? new PostgresComparisonStore(neon(url)) : new NoComparisonStore();
    stores.set(kind, store);
  }
  return store;
}

/** Record without ever failing the caller. */
export async function recordComparison(target: ComparisonStore, record: ComparisonRecord, runKey?: string): Promise<void> {
  try {
    await target.record(record, runKey);
  } catch (error) {
    log.warn("baseline comparison not recorded", { store: target.kind, error: error instanceof Error ? error.message : "unknown" });
  }
}

/** Record an agent run without ever failing the caller. */
export async function recordAgentRun(target: ComparisonStore, record: AgentRecord): Promise<void> {
  try {
    await target.recordAgent(record);
  } catch (error) {
    log.warn("agent comparison not recorded", { store: target.kind, error: error instanceof Error ? error.message : "unknown" });
  }
}

export function resetComparisonStoresForTests() {
  stores.clear();
}
