import { connection } from "next/server";
import { comparisonStore } from "@/server/comparisons/store";
import { adapterContextFor } from "@/server/request";

/**
 * GET /api/baseline-stats: read-only aggregate of the plain-AI baseline
 * comparisons ("x of Busk Map's top-3 picks are places a plain AI didn't
 * name; average score delta y"), and Agent v2 against the engine alone (how
 * often Claude's top 3 differs, and its engine-score delta). No personal data
 * is stored or returned.
 */
export async function GET() {
  // Live stats: never prerendered.
  await connection();
  const store = comparisonStore(adapterContextFor(null).offline);
  try {
    const stats = await store.stats();
    if (!stats) return Response.json({ store: store.kind, stats: null, message: "Comparisons are not recorded here (no DATABASE_URL)." }, { headers: { "Cache-Control": "no-store" } });
    const summary =
      stats.picks === 0
        ? "No comparisons recorded yet."
        : `${stats.uniquePicks} of ${stats.picks} Busk Map top-3 picks (${Math.round((stats.uniqueRate ?? 0) * 100)}%) are places the plain AI didn't name` +
          (stats.averageScoreDelta === null ? "." : `; average score delta ${stats.averageScoreDelta >= 0 ? "+" : ""}${stats.averageScoreDelta.toFixed(1)} points over ${stats.runsWithScoredPlainSpots} runs.`) +
          (stats.agentRuns === 0
            ? " No Agent v2 runs recorded yet."
            : ` Agent v2: Claude's top 3 differed from the engine's in ${stats.agentDiffersRuns} of ${stats.agentRuns} runs (${stats.agentDifferentPicks} of ${stats.agentPicks} picks)` +
              (stats.averageAgentScoreDelta === null ? "." : `; engine score delta ${stats.averageAgentScoreDelta >= 0 ? "+" : ""}${stats.averageAgentScoreDelta.toFixed(1)} points (Claude's picks minus the engine's top 3).`));
    return Response.json({ store: store.kind, stats, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "unavailable", message: "Comparison stats are unavailable right now." } }, { status: 503 });
  }
}
