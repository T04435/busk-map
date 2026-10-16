import { Icon } from "@/components/honeycomb/icon";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Loader } from "@/components/honeycomb/loader";
import type { RunUsage } from "@/lib/agent-steps";
import { modelName, type ExplanationsModel } from "@/lib/sources";

export type AgentState = "none" | "researching" | "engine" | "rerun" | "done" | "replayed";

/** The line under the header, in brand words: Claude (or the test model offline) and Busk Map's scores, never "agent" or "engine" (B-049, B-108). */
const text = (state: AgentState, model: ExplanationsModel | null | undefined): string => {
  const name = modelName(model, "start");
  switch (state) {
    case "none":
      return "No new plan was started.";
    case "researching":
      return `${name} is researching with Qloo and the other sources. Your busk replaces the research here in about half a minute.`;
    case "engine":
      return "Planned from Busk Map's scores, without a model.";
    case "rerun":
      return `${name} is checking again. The busk below stays until it finishes.`;
    case "done":
      return `${name}'s plan.`;
    case "replayed":
      return "Shown as it was researched. Nothing new was asked.";
  }
};

/** One line under the header saying what the agent is doing, with the run's note and usage. Keeps `agent-status` and `agent-usage`. */
export function AgentStatusLine({ state, note, usage, model }: { state: AgentState | null; note?: string | null; usage?: RunUsage | null; model?: ExplanationsModel | null }) {
  const live = state === "researching" || state === "rerun";
  return (
    <div role="status" aria-live={live ? "polite" : "off"} className="flex flex-col gap-1 text-sm">
      {state ? (
        <p className="m-0 flex items-center gap-2">
          <HexCell size={24} tone={live ? "primary" : state === "none" ? "dashed" : "default"}>
            {live ? <Loader size={12} /> : state === "none" ? <Icon name="clock" size={12} /> : <Icon name="check" size={12} />}
          </HexCell>
          <span className="text-muted-foreground" data-testid="agent-status">
            {note && state === "replayed" ? note : text(state, model)}
          </span>
        </p>
      ) : null}
      {note && state !== "replayed" ? <p className="m-0 text-muted-foreground">{note}</p> : null}
      {usage ? (
        <p className="m-0 font-mono text-[13px] text-muted-foreground" data-testid="agent-usage">
          {usage.steps} model steps · {usage.inputTokens.toLocaleString("en-AU")} input and {usage.outputTokens.toLocaleString("en-AU")} output tokens
          {usage.reasoningTokens ? ` (${usage.reasoningTokens.toLocaleString("en-AU")} thinking)` : ""} · {(usage.ms / 1000).toFixed(1)} s
        </p>
      ) : null}
    </div>
  );
}
