/**
 * Folding the agent's stream into steps (shared by the live view and the
 * replay). Pure, client-safe.
 */
import type { CallRecord } from "./call-record";
import type { LearnStreamEvent } from "./learn-schema";
import type { MentionSource } from "./mention";
import type { PlanStreamEvent } from "./plan-schema";

export type StepNote = { kind: "reasoning" | "text"; text: string };

export type AgentStep = {
  id: string;
  /** null: notes with no tool call after them (yet). */
  tool: string | null;
  label: string;
  source?: string;
  /** The one source the running step turned out to use (a `tool-source` event), for its Hive mark. */
  via?: MentionSource;
  input?: unknown;
  /** "waiting": a research step paused for the performer's input (its output carries `waiting`). */
  status: "running" | "done" | "failed" | "notes" | "cut" | "waiting";
  summary?: string;
  output?: unknown;
  /** The external calls the step made (Repertoire research), for its RAW panel. */
  calls?: CallRecord[];
  notes: StepNote[];
};

export type RunUsage = Extract<PlanStreamEvent, { type: "usage" }>;

/** Fold stream events into a list of steps. Notes attach to the next tool call. */
export function applyStreamEvent(steps: AgentStep[], event: PlanStreamEvent | LearnStreamEvent): AgentStep[] {
  const last = steps.at(-1);
  if (event.type === "note") {
    const note = { kind: event.kind, text: event.text };
    if (last && last.tool === null) return [...steps.slice(0, -1), { ...last, notes: [...last.notes, note] }];
    return [...steps, { id: `notes-${steps.length}`, tool: null, label: "Notes", status: "notes", notes: [note] }];
  }
  if (event.type === "tool-start") {
    const step: AgentStep = { id: event.id, tool: event.tool, label: event.label, source: event.source, input: event.input, status: "running", notes: [] };
    if (last && last.tool === null) return [...steps.slice(0, -1), { ...step, notes: last.notes }];
    return [...steps, step];
  }
  if (event.type === "tool-source") {
    return steps.map((s) => (s.id === event.id ? { ...s, via: event.source } : s));
  }
  if (event.type === "tool-end") {
    const waits = event.ok && isWaitingOutput(event.output);
    return steps.map((s) => (s.id === event.id ? { ...s, status: waits ? "waiting" : event.ok ? "done" : "failed", summary: event.summary, output: event.output, ...(event.calls ? { calls: event.calls } : {}) } : s));
  }
  return steps;
}

/** A step output that says the run waits for input (Repertoire research). */
export const isWaitingOutput = (output: unknown): boolean => output !== null && typeof output === "object" && Boolean((output as { waiting?: unknown }).waiting);

export const scalar = (v: unknown): string => {
  if (v === null || v === undefined) return "none";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object")) return v.map(scalar).join(", ");
  return JSON.stringify(v);
};

/** Inputs as "key: value" pairs, nested objects flattened one level ("at: pitchId spot:x"). */
export function formatInput(input: unknown): string {
  if (input === null || input === undefined || typeof input !== "object") return scalar(input);
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return "(defaults)";
  return entries
    .map(([k, v]) =>
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? `${k}: ${Object.entries(v as Record<string, unknown>)
            .map(([kk, vv]) => `${kk} ${scalar(vv)}`)
            .join(", ")}`
        : `${k}: ${scalar(v)}`,
    )
    .join(" · ");
}

