import { Check, Clock } from "lucide-react";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Loader } from "@/components/honeycomb/loader";
import type { RunUsage } from "@/lib/agent-steps";

export type AgentState = "none" | "researching" | "engine" | "rerun" | "done" | "replayed";

const TEXT: Record<AgentState, string> = {
  none: "No new plan was started.",
  researching: "The agent is researching with Qloo and the other sources. The plan appears when it finishes.",
  engine: "Shown: the engine's plan from the data, without the agent.",
  rerun: "The agent is running again. The plan below stays until it finishes.",
  done: "The agent's plan.",
  replayed: "The agent's plan, replayed.",
};

/** One line under the header saying what the agent is doing, with the run's note and usage. Keeps `agent-status` and `agent-usage`. */
export function AgentStatusLine({ state, note, usage }: { state: AgentState | null; note?: string | null; usage?: RunUsage | null }) {
  const live = state === "researching" || state === "rerun";
  return (
    <div role="status" aria-live={live ? "polite" : "off"} className="flex flex-col gap-1 text-sm">
      {state ? (
        <p className="m-0 flex items-center gap-2">
          <HexCell size={24} tone={live ? "primary" : state === "none" ? "dashed" : "default"}>
            {live ? <Loader size={12} /> : state === "none" ? <Clock aria-hidden="true" className="size-3" /> : <Check aria-hidden="true" className="size-3" />}
          </HexCell>
          <span className="text-muted-foreground" data-testid="agent-status">
            {TEXT[state]}
          </span>
        </p>
      ) : null}
      {note ? <p className="m-0 text-muted-foreground">{note}</p> : null}
      {usage ? (
        <p className="m-0 font-mono text-[13px] text-muted-foreground" data-testid="agent-usage">
          {usage.steps} model steps · {usage.inputTokens.toLocaleString("en-AU")} input and {usage.outputTokens.toLocaleString("en-AU")} output tokens
          {usage.reasoningTokens ? ` (${usage.reasoningTokens.toLocaleString("en-AU")} thinking)` : ""} · {(usage.ms / 1000).toFixed(1)} s
        </p>
      ) : null}
    </div>
  );
}
