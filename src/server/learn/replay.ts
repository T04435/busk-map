import "server-only";
import { skippedOf, ZERO_LEARN_TOTALS, type LearnStreamEvent, type LearnSuggestionEvent, type LearnTotals } from "@/lib/learn-schema";
import type { LearnSuggestionView } from "@/lib/playlist-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { RunRecord } from "./types";

/** A saved suggestion as the stream sends it (§7.2). */
export function suggestionEvent(runId: string, s: LearnSuggestionView): LearnSuggestionEvent {
  return {
    type: "suggestion",
    runId,
    id: s.id,
    rank: s.rank ?? 0,
    title: s.title,
    artist: s.artist,
    year: s.year,
    durationMs: s.durationMs,
    image: s.image,
    songSource: s.songSource === "lastfm" ? "lastfm" : "spotify",
    sourceUrl: s.sourceUrl,
    reason: s.reason,
    because: s.because,
    basedOn: s.basedOn,
    growth: s.growth,
    trendDelta: s.trendDelta,
    isNew: s.isNew,
    status: s.status,
  };
}

/** How a finished run ended, as the `end` event says it (live and on replay alike). */
export function endOf(record: Pick<RunRecord, "status" | "endCode" | "model" | "newCount" | "skippedCount" | "id"> & { totals?: Pick<LearnTotals, "songsChecked"> | null }): Extract<LearnStreamEvent, { type: "end" }> {
  const ok = record.status !== "failed";
  const mode = !ok ? "none" : record.status === "fallback" ? "fallback" : record.model === "mock" ? "mock" : "agent";
  const code = (record.endCode ?? null) as Extract<LearnStreamEvent, { type: "end" }>["code"];
  return {
    type: "end",
    ok,
    runId: record.id,
    mode,
    newCount: record.newCount,
    skippedCount: record.skippedCount,
    code,
    message: PLAYLIST_COPY.learn.end({ ok, mode, code, newCount: record.newCount, skippedCount: record.skippedCount, songsChecked: record.totals?.songsChecked }),
  };
}

/**
 * A finished run replayed from the store: the run, its stored steps (none once pruned), its suggestions with their
 * CURRENT status, the final totals, the usage and the end. A replay never calls a model or Qloo and is never counted
 * against the limit.
 */
export function replayEvents(record: RunRecord, suggestions: LearnSuggestionView[]): LearnStreamEvent[] {
  const steps = record.steps;
  const events: LearnStreamEvent[] = [
    {
      type: "run",
      runId: record.id,
      number: record.number,
      startedAt: new Date(record.startedAt).toISOString(),
      model: record.model === "mock" ? "mock" : "claude",
      inputs: record.inputs,
      replay: true,
      stepsKept: steps !== null,
    },
    { type: "status", message: steps !== null ? PLAYLIST_COPY.learn.replaying(record.number) : PLAYLIST_COPY.learn.stepsPruned, replay: true },
    // The run's own "started" line gives way to the replay line above.
    ...(steps ?? []).filter((e) => e.type !== "status"),
    ...suggestions.map((s) => suggestionEvent(record.id, s)),
    { type: "totals", totals: record.totals ?? ZERO_LEARN_TOTALS },
  ];
  if (record.usage) events.push({ type: "usage", ...record.usage });
  events.push(endOf(record));
  return events;
}

export { skippedOf };
