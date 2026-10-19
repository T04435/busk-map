import { connection } from "next/server";
import { modelName, type ExplanationsModel } from "@/lib/sources";
import { comparisonStore, type ComparisonStats } from "@/server/comparisons/store";
import { adapterContextFor } from "@/server/request";

/**
 * GET /api/baseline-stats: read-only aggregate of the plain-AI baseline
 * comparisons ("x of Busk Map's top-3 picks are places a plain AI didn't
 * name; average score delta y"), and Agent v2 against the engine alone: the
 * divergence rate (runs where Claude's top 3 differs from the engine's in set
 * or order), the average number of positions changed, and the average
 * engine-score delta. Top level: `agentDiffersRate` (0–1, null when n = 0),
 * `n` (agent runs with both an engine and an agent top 3) and `dateRange`
 * ({ from, to } ISO dates of the earliest and latest of those runs, or null).
 * No personal data is stored or returned.
 */
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

function agentSummary(stats: ComparisonStats, model: ExplanationsModel): string {
  if (stats.agentRuns === 0) return " No Agent v2 runs recorded yet.";
  return (
    ` Agent v2 vs engine: divergence ${Math.round((stats.agentDiffersRate ?? 0) * 100)}% (${stats.agentDiffersRuns} of ${stats.agentRuns} runs differ in set or order; ${stats.agentDifferentSetRuns} in set)` +
    `; ${(stats.averagePositionsChanged ?? 0).toFixed(2)} positions changed on average` +
    (stats.averageAgentScoreDelta === null ? "." : `; engine score delta ${signed(stats.averageAgentScoreDelta)} points (${modelName(model, "start")}'s picks minus the engine's top 3).`)
  );
}

export async function GET() {
  // Live stats: never prerendered.
  await connection();
  const offline = adapterContextFor(null).offline;
  const store = comparisonStore(offline);
  // Offline, the runs recorded here are the test model's (B-010).
  const model: ExplanationsModel = offline ? "mock" : "claude";
  try {
    const stats = await store.stats();
    if (!stats)
      return Response.json(
        { store: store.kind, stats: null, agentDiffersRate: null, n: 0, dateRange: null, message: "Comparisons are not recorded here (no DATABASE_URL)." },
        { headers: { "Cache-Control": "no-store" } },
      );
    const summary =
      stats.picks === 0
        ? `No baseline comparisons recorded yet.${agentSummary(stats, model)}`
        : `${stats.uniquePicks} of ${stats.picks} Busk Map top-3 picks (${Math.round((stats.uniqueRate ?? 0) * 100)}%) are places the plain AI didn't name` +
          (stats.averageScoreDelta === null ? "." : `; average score delta ${stats.averageScoreDelta >= 0 ? "+" : ""}${stats.averageScoreDelta.toFixed(1)} points over ${stats.runsWithScoredPlainSpots} runs.`) +
          agentSummary(stats, model);
    // Agent vs engine at the top level: the divergence rate (null when n = 0), its sample size and the runs' date range.
    return Response.json(
      { store: store.kind, stats, summary, agentDiffersRate: stats.agentDiffersRate, n: stats.agentSampleSize, dateRange: stats.agentDateRange },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: { code: "unavailable", message: "Comparison stats are unavailable right now." } }, { status: 503 });
  }
}
