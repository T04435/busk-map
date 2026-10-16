/**
 * Client-safe schemas and wire types for the learn run ("Songs to learn", docs/playlist-architecture.md §2.7, §7).
 * The stream reuses the plan stream's status, note, tool-start, tool-end and usage events field for field
 * (plan-schema.ts) and adds run, totals (learn fields), suggestion and end. It has no `plan` and no `error` event:
 * every learn stream ends with exactly one `end`.
 */
import { z } from "zod";
import { streamNoteSchema, streamStatusSchema, streamToolEndSchema, streamToolStartSchema, streamUsageSchema } from "./plan-schema";

const count = z.number().int().min(0);

/** Who ranked the songs: the wire values of `run.model` and the list's `model`. "template" = the deterministic fallback. */
export const LEARN_MODELS = ["claude", "mock", "template"] as const;
export type LearnModel = (typeof LEARN_MODELS)[number];

export const LEARN_RUN_STATUSES = ["running", "done", "failed", "fallback"] as const;
export type LearnRunStatus = (typeof LEARN_RUN_STATUSES)[number];

/** spotify_*: a Repertoire research run (lib/repertoire-research.ts) that couldn't read the Spotify profile. */
export const LEARN_END_CODES = ["timeout", "stopped", "model_unavailable", "qloo_unavailable", "no_match", "nothing_new", "spotify_unavailable", "spotify_not_found"] as const;
export type LearnEndCode = (typeof LEARN_END_CODES)[number];

export const BASED_ON_KINDS = ["learned", "repertoire", "crowd", "soundsLike"] as const;
export type BasedOnKind = (typeof BASED_ON_KINDS)[number];

/** What a run looked at: the can-sing + learned count, the sounds-like names, the usual pitch names (empty = the city crowd). */
export const learnInputsSchema = z.object({
  songs: count,
  soundsLike: z.array(z.string()),
  pitches: z.array(z.string()),
  /** Absent on a learn run (and on every run saved before research). "research": a full Repertoire research run; "more": its "Find more songs to learn". */
  kind: z.enum(["research", "more"]).optional(),
});
export type LearnInputs = z.infer<typeof learnInputsSchema>;

/**
 * Running totals over the finished tool calls so far (lib/learn-totals.ts). `newSongs` is 0 until the picks are accepted.
 * qlooCalls and qlooCacheHits come from the run's Qloo counter (adapters/qloo/usage.ts).
 */
export const learnTotalsSchema = z.object({
  artists: count,
  crowds: count,
  liked: count,
  songsChecked: count,
  alreadySuggested: count,
  dismissedSkipped: count,
  alreadyKnown: count,
  newSongs: count,
  qlooCalls: count,
  qlooCacheHits: count,
});
export type LearnTotals = z.infer<typeof learnTotalsSchema>;
export const ZERO_LEARN_TOTALS: LearnTotals = { artists: 0, crowds: 0, liked: 0, songsChecked: 0, alreadySuggested: 0, dismissedSkipped: 0, alreadyKnown: 0, newSongs: 0, qlooCalls: 0, qlooCacheHits: 0 };

export const basedOnSchema = z.object({ kind: z.enum(BASED_ON_KINDS), name: z.string() });

/** One saved suggestion, as the `suggestion` event sends it (§7.2). The list (§7.3) returns the same fields plus its own. */
export const learnSuggestionEventSchema = z.object({
  type: z.literal("suggestion"),
  runId: z.string(),
  id: z.string(),
  rank: z.number().int(),
  title: z.string(),
  artist: z.string(),
  year: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  image: z.string().nullable(),
  songSource: z.enum(["spotify", "lastfm"]),
  sourceUrl: z.string().nullable(),
  reason: z.string(),
  because: z.string().nullable(),
  basedOn: z.array(basedOnSchema),
  growth: z.number().nullable(),
  /** Percentile points gained in Qloo's population percentile over the trending window (positive is rising). Null when flat or unchecked. */
  trendDelta: z.number().nullable(),
  isNew: z.boolean(),
  status: z.enum(["pending", "learned", "dismissed"]),
});

export const learnEndSchema = z.object({
  type: z.literal("end"),
  ok: z.boolean(),
  runId: z.string(),
  mode: z.enum(["agent", "fallback", "mock", "none"]),
  newCount: count,
  skippedCount: count,
  code: z.enum(LEARN_END_CODES).nullable(),
  message: z.string(),
});

export const learnStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run"),
    runId: z.string(),
    number: z.number().int().min(1),
    startedAt: z.string(),
    model: z.enum(["claude", "mock"]),
    inputs: learnInputsSchema,
    replay: z.boolean(),
    stepsKept: z.boolean(),
  }),
  streamStatusSchema,
  streamNoteSchema,
  streamToolStartSchema,
  streamToolEndSchema,
  z.object({ type: z.literal("totals"), totals: learnTotalsSchema }),
  learnSuggestionEventSchema,
  streamUsageSchema,
  learnEndSchema,
]);
export type LearnStreamEvent = z.infer<typeof learnStreamEventSchema>;
export type LearnSuggestionEvent = z.infer<typeof learnSuggestionEventSchema>;
export type LearnEnd = z.infer<typeof learnEndSchema>;
export type LearnRunEvent = Extract<LearnStreamEvent, { type: "run" }>;

/** The stored steps of a run: every event except run, suggestion, end, usage and the final totals (docs §1.2). */
export type StoredLearnStep = Exclude<LearnStreamEvent, { type: "run" | "suggestion" | "end" | "usage" }>;

// --- The Learn list: GET /api/playlist/learn (§7.3) ---

export type LearnRunView = {
  runId: string;
  number: number;
  startedAt: string;
  finishedAt: string | null;
  status: LearnRunStatus;
  model: LearnModel;
  inputs: LearnInputs;
  newCount: number;
  skippedCount: number;
  stepsKept: boolean;
};

export type LearnLimitView = { max: number; windowMinutes: number; remaining: number; retryInMinutes: number | null };

export type LearnListView = {
  running: { runId: string; number: number; startedAt: string } | null;
  limit: LearnLimitView;
  runs: LearnRunView[];
  suggestions: import("./playlist-schema").LearnSuggestionView[];
  /** How many suggestions wait in the To learn list (status pending), and the cap (list_full past it). */
  pending: { count: number; max: number };
};

/** PATCH /api/playlist/learn/suggestions/<id>: a transition from §1.3. */
export const patchSuggestionSchema = z.object({ status: z.enum(["pending", "learned", "dismissed"]) });
export type PatchSuggestionInput = z.infer<typeof patchSuggestionSchema>;

// --- Refusals before a run starts (HTTP, §7.2) ---

export type LearnLimitScope = "repertoire" | "ip";

export type LearnLimitBody = {
  error: {
    code: "limit";
    message: string;
    retryAt: string;
    retryAfterS: number;
    limit: { scope: LearnLimitScope; max: number; windowMinutes: number; retryInMinutes: number; resetAt: string };
  };
};

/** The counts the end event's message and the run bar read. */
export const skippedOf = (t: Pick<LearnTotals, "alreadySuggested" | "dismissedSkipped" | "alreadyKnown">) => t.alreadySuggested + t.dismissedSkipped + t.alreadyKnown;

/** "claude" | "mock" | "template" as the run header shows it. */
export function learnModelLabel(model: LearnModel): string {
  return model === "claude" ? "Claude" : model === "mock" ? "test model" : "from the data";
}

/** "Fans of A and B like them": plain words from Qloo explainability (the names of the input artists that drove a result). Null with none. */
export function becauseText(names: readonly string[]): string | null {
  const [a, b] = names;
  if (!a) return null;
  return b ? `Fans of ${a} and ${b} like them` : `Fans of ${a} like them`;
}
