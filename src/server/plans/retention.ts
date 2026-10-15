import "server-only";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { planStore } from "@/server/agent/plan-store";
import { RAW_STEP_RETENTION_MS } from "./retention-core";
import { shortPlanStore } from "./store";

/**
 * Retention: raw Qloo-derived step data is kept 7 days; plans and links persist.
 *
 * A stored run's steps hold, per tool call, the data the tool returned (the
 * `output` of each "tool-end" event, much of it derived from Qloo). After
 * RAW_STEP_RETENTION_MS that output is removed. Everything else stays: the
 * plan, the step labels, the inputs Claude chose, the summaries and the notes,
 * so the link still shows the plan and what the agent did. A stripped step is
 * marked `pruned: true`.
 *
 * pruneRawStepData() does it for every stored plan and run (the daily cron,
 * /api/cron/prune); the plan page also strips a snapshot on read when it is
 * older (lazy). Both are idempotent.
 */
export { hasRawStepData, pastRetention, RAW_STEP_RETENTION_MS, stripStepOutputs } from "./retention-core";

export type PruneResult = {
  /** Short-link plans whose steps were stripped now. */
  plans: number;
  /** Stored runs (plan_store) whose steps were stripped now. */
  runs: number;
  /** Expired plan_store rows deleted (runs and baselines past their 15 min / 6 h expiry). */
  expired: number;
  cutoff: string;
  stores: { plans: string; runs: string };
};

/** Strip raw step data older than the retention period from every store. Idempotent: a second run changes nothing. */
export async function pruneRawStepData(now = Date.now()): Promise<PruneResult> {
  const offline = testSwitches().offline;
  const plans = shortPlanStore(offline);
  const runs = planStore(offline);
  const cutoff = now - RAW_STEP_RETENTION_MS;
  const [stripped, store] = await Promise.all([plans.pruneRawSteps(cutoff), runs.pruneRawSteps(cutoff, now)]);
  const result = { plans: stripped, runs: store.runs, expired: store.expired, cutoff: new Date(cutoff).toISOString(), stores: { plans: plans.kind, runs: runs.kind } };
  log.info("raw step data pruned", result);
  return result;
}
