import "server-only";
import { skippedOf, type LearnStreamEvent, type StoredLearnStep } from "@/lib/learn-schema";
import { fromLearnOutputs } from "@/lib/learn-totals";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { AdapterContext } from "@/server/adapters/core";
import { withQlooUsage } from "@/server/adapters/qloo/usage";
import { CITIES } from "@/server/cities";
import { log } from "@/server/log";
import { LEARN_LIMITS, LEARN_STEPS_MAX_BYTES } from "@/server/playlist/config";
import type { PlaylistRecord } from "@/server/playlist/store";
import { runLearnAgent, type LearnAgentOptions } from "./agent";
import { LearnContext } from "./context";
import { endOf, suggestionEvent } from "./replay";
import type { LearnRun } from "./runs";
import type { LearnStore } from "./store";
import type { HistoryData, RunRecord } from "./types";
import { serverToday } from "@/server/clock";

/** The stored steps of a run, trimmed to each tool's summary if they would pass the size cap (docs §1.2). */
export function boundSteps(steps: StoredLearnStep[], maxBytes = LEARN_STEPS_MAX_BYTES): StoredLearnStep[] {
  if (JSON.stringify(steps).length <= maxBytes) return steps;
  // A research step that waits for input keeps what it waits for (the view draws the ask from it).
  const waitingOf = (output: unknown) => (output !== null && typeof output === "object" && "waiting" in output ? { waiting: (output as { waiting: unknown }).waiting } : {});
  return steps.map((e) => (e.type === "tool-end" ? { ...e, output: { summary: e.summary, ...waitingOf(e.output) } } : e.type === "tool-start" ? { ...e, input: undefined } : e));
}

/**
 * One learn run, start to end: the events the stream sends (docs §7.2 order: run → status → steps → suggestion × n → totals →
 * usage → end), then the saved run row. Nothing here throws: whatever goes wrong, the stream ends with exactly one `end`.
 *
 * The run does not stop when the viewer leaves; the agent's own timeout and step limit bound it.
 */
export async function executeLearnRun(args: {
  learn: LearnStore;
  playlist: PlaylistRecord;
  history: HistoryData;
  adapters: AdapterContext;
  record: RunRecord;
  run: LearnRun;
  signal?: AbortSignal;
  options?: LearnAgentOptions;
}): Promise<void> {
  const { learn, playlist, history, adapters, record, run, options } = args;
  const steps: StoredLearnStep[] = [];
  const push = (event: LearnStreamEvent) => {
    run.push(event);
    // Stored: the steps, not the run, the saved suggestions, the final totals, the usage or the end.
    if (event.type === "status" || event.type === "note" || event.type === "tool-start" || event.type === "tool-end" || event.type === "totals") steps.push(event);
  };
  run.push({
    type: "run",
    runId: record.id,
    number: record.number,
    startedAt: new Date(record.startedAt).toISOString(),
    model: adapters.offline && !options?.model ? "mock" : "claude",
    inputs: record.inputs,
    replay: false,
    stepsKept: true,
  });
  push({ type: "status", message: PLAYLIST_COPY.learn.runStarted });
  try {
    const today = serverToday(CITIES.melbourne.timeZone);
    const outcome = await withQlooUsage(async (usage) => {
      const ctx = new LearnContext(adapters, playlist, history, today, usage);
      const result = await runLearnAgent(
        ctx,
        {
          onNote: (e) => push({ type: "note", ...e }),
          onToolStart: (e) => push({ type: "tool-start", ...e }),
          onToolEnd: (e) => push({ type: "tool-end", ...e }),
          onTotals: (totals) => push({ type: "totals", totals }),
        },
        args.signal ?? AbortSignal.timeout(LEARN_LIMITS.timeoutMs + 20_000),
        options,
      );
      return { result, qlooCalls: usage.calls, qlooCacheHits: usage.cacheHits };
    });
    const { result } = outcome;
    // The unique key is the last check: a pick that lost a race with a song you just added is skipped, not an error.
    const saved = result.picks.length ? await learn.insertSuggestions(playlist.id, record.id, result.picks) : [];
    const totals = fromLearnOutputs(result.toolResults, { newSongs: saved.length, qlooCalls: outcome.qlooCalls, qlooCacheHits: outcome.qlooCacheHits });
    const nothingSaved = result.picks.length > 0 && saved.length === 0;
    const status: "failed" | "done" | "fallback" = nothingSaved ? "done" : result.status;
    const endCode = nothingSaved ? "nothing_new" : result.endCode;
    const finished = { ...record, status, endCode, newCount: saved.length, skippedCount: skippedOf(totals), model: record.model, totals };
    for (const s of saved) run.push(suggestionEvent(record.id, s));
    run.push({ type: "totals", totals });
    if (result.usage) run.push({ type: "usage", ...result.usage });
    run.push(endOf(finished));
    await learn.finishRun(record.id, { status, endCode, steps: boundSteps(steps), totals, usage: result.usage, newCount: saved.length, skippedCount: skippedOf(totals) });
  } catch (error) {
    log.error("learn run failed", { error: error instanceof Error ? error.message : "unknown" });
    const finished = { ...record, status: "failed" as const, endCode: null, newCount: 0, skippedCount: 0 };
    run.push(endOf(finished));
    await learn.finishRun(record.id, { status: "failed", endCode: null, steps: boundSteps(steps), totals: fromLearnOutputs([]), usage: null, newCount: 0, skippedCount: 0 }).catch(() => undefined);
  } finally {
    run.finish();
  }
}
