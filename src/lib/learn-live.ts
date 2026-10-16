/**
 * The page's view of a learn run as its stream arrives (docs/playlist-architecture.md §7.2, §7.4): the steps (folded by
 * applyStreamEvent, the plan's reducer), the running totals, the suggestions saved so far and the end. Pure, client-safe.
 */
import { applyStreamEvent, type AgentStep } from "./agent-steps";
import { ZERO_LEARN_TOTALS, type LearnEnd, type LearnStreamEvent, type LearnSuggestionEvent, type LearnTotals } from "./learn-schema";

export type LearnLive = {
  runId: string | null;
  number: number | null;
  model: "claude" | "mock" | null;
  replay: boolean;
  steps: AgentStep[];
  totals: LearnTotals;
  suggestions: LearnSuggestionEvent[];
  usage: Extract<LearnStreamEvent, { type: "usage" }> | null;
  status: string | null;
  end: LearnEnd | null;
};

export const emptyLive = (): LearnLive => ({ runId: null, number: null, model: null, replay: false, steps: [], totals: ZERO_LEARN_TOTALS, suggestions: [], usage: null, status: null, end: null });

export function applyLearnEvent(live: LearnLive, event: LearnStreamEvent): LearnLive {
  switch (event.type) {
    case "run":
      return { ...emptyLive(), runId: event.runId, number: event.number, model: event.model, replay: event.replay };
    case "status":
      return { ...live, status: event.message };
    case "totals":
      return { ...live, totals: event.totals };
    case "suggestion":
      return { ...live, suggestions: [...live.suggestions, event] };
    case "usage":
      return { ...live, usage: event };
    case "end":
      return { ...live, end: event };
    default:
      return { ...live, steps: applyStreamEvent(live.steps, event) };
  }
}

/** Read an NDJSON body line by line (the page's stream reader). */
export async function* ndjsonLines(body: NonNullable<Response["body"]>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield line;
  }
  if (buffer.trim()) yield buffer;
}
