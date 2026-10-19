import type { LearnInputs, LearnModel, LearnRunStatus, LearnTotals, StoredLearnStep } from "@/lib/learn-schema";
import type { LearnSuggestionView } from "@/lib/playlist-schema";

/** Shared by the learn store and the Repertoire's memory store (which holds the rows offline). No server imports here. */

export type RunUsage = { inputTokens: number; outputTokens: number; reasoningTokens: number; steps: number; ms: number; stoppedBy: string };

/** A learn run (table learn_runs). `steps` is null once pruned (last 5 runs, 30 days). */
export type RunRecord = {
  id: string;
  playlistId: string;
  number: number;
  startedAt: number;
  finishedAt: number | null;
  status: LearnRunStatus;
  endCode: string | null;
  model: LearnModel;
  inputs: LearnInputs;
  steps: StoredLearnStep[] | null;
  totals: LearnTotals | null;
  usage: RunUsage | null;
  newCount: number;
  skippedCount: number;
};

/** The small derived numbers a suggestion keeps, never raw tool output (docs §1.2). */
export type Evidence = {
  ranker: "claude" | "mock" | "template";
  artistFrom: "related_artists" | "crowd_at" | "plan";
  because: string[];
  affinity: number | null;
  growth: number | null;
  /** Percentile points the artist gained in Qloo's population percentile over the trending window (0-100 scale, positive is rising). Null when flat or unchecked. */
  trendDelta: number | null;
  pitch?: string;
  basedOn: LearnSuggestionView["basedOn"];
};

/** One pick, ready to save. Every catalogue field comes from the record top_tracks returned, never from model text. */
export type NewSuggestion = {
  songKey: string;
  title: string;
  artist: string;
  spotifyTrackId: string | null;
  qlooArtistId: string | null;
  year: number | null;
  durationMs: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  songSource: "spotify" | "lastfm";
  reason: string;
  evidence: Evidence;
  rank: number;
};

/** A suggestion as the memory store keeps it: the view plus what the view leaves out. */
export type MemorySuggestion = LearnSuggestionView & {
  songKey: string;
  spotifyTrackId?: string | null;
  qlooArtistId?: string | null;
  evidence?: Evidence;
};

/** Everything the run needs to know about earlier runs (docs §2.8). */
export type HistoryData = {
  /** Songs you can sing and learned songs. */
  songs: { title: string; artist: string; key: string; state: "can_sing" | "learned" }[];
  /** Every suggestion, any status, newest first. */
  suggestions: { title: string; artist: string; key: string; status: "pending" | "learned" | "dismissed"; runNumber: number | null; at: number }[];
  /** Keys of dismissed suggestions removed by the size cap: they still count as dismissed. */
  dismissedKeys: string[];
  earlierRuns: number;
  lastRun: { number: number; startedAt: number; newCount: number } | null;
};

export type StartRunResult = { ok: true; run: RunRecord } | { ok: false; reason: "already_running"; runId: string | null };

export type SetStatusResult =
  | { ok: true; suggestion: LearnSuggestionView; song: import("@/lib/playlist-schema").PlaylistSongView | null; revision: number }
  | { ok: false; reason: "missing" | "invalid" };

export type FinishRun = {
  status: Exclude<LearnRunStatus, "running">;
  endCode: string | null;
  steps: StoredLearnStep[] | null;
  totals: LearnTotals;
  usage: RunUsage | null;
  newCount: number;
  skippedCount: number;
};
