import { HiveMark } from "@/components/honeycomb/hive-mark";
import { AGENT_NAME_INLINE, AGENT_NAME_START } from "@/lib/agent-persona";
import type { RunUsage } from "@/lib/agent-steps";
import type { ExplanationsModel } from "@/lib/sources";

export type AgentState = "none" | "researching" | "engine" | "rerun" | "done" | "replayed";

/**
 * The line under the header, in the Hive's voice (persona B, copy table "Research status line"): it names its sources, and
 * Busk Map's scores when it didn't run. Offline, the test model is named, never Claude (B-049, B-108).
 */
const text = (state: AgentState, model: ExplanationsModel | null | undefined): string => {
  const offline = model === "mock" ? " (offline test model)" : "";
  switch (state) {
    case "none":
      return "No new plan was started.";
    case "researching":
      return `${AGENT_NAME_START} is asking Qloo, the city's sensors and the council's rules. Your busk replaces this in about half a minute${offline}.`;
    case "engine":
      return `Planned from Busk Map's scores. ${AGENT_NAME_START} didn't run.`;
    case "rerun":
      return `${AGENT_NAME_START} is checking again. The busk below stays until we're done.`;
    case "done":
      return `Researched by ${AGENT_NAME_INLINE}${offline}.`;
    case "replayed":
      return `Shown as ${AGENT_NAME_INLINE} researched it. Nothing new was asked.`;
  }
};

/**
 * One line under the header saying what the agent is doing, with the Hive's mark (24), the run's note and usage. Keeps
 * `agent-status` and `agent-usage`. `progress` fills the mark while live (default 0: the centre pulses).
 */
export function AgentStatusLine({
  state,
  note,
  usage,
  model,
  progress,
}: {
  state: AgentState | null;
  note?: string | null;
  usage?: RunUsage | null;
  model?: ExplanationsModel | null;
  /** Cells filled while researching or checking again, 0–6 (hiveProgressOfSteps in lib/agent-persona). */
  progress?: number;
}) {
  const live = state === "researching" || state === "rerun";
  return (
    <div role="status" aria-live={live ? "polite" : "off"} className="flex flex-col gap-1">
      {state ? (
        <p className="m-0 flex items-start gap-2 font-mono text-sm leading-5 font-medium">
          {/* -2px top and bottom: the 24px mark centres on the first 20px line, and wrapped lines run on under the text. */}
          <HiveMark
            className="-my-0.5"
            size={24}
            live={live}
            muted={state === "none"}
            progress={live ? (progress ?? 0) : state === "done" || state === "replayed" ? 7 : 0}
          />
          <span data-testid="agent-status">
            {note && state === "replayed" ? note : text(state, model)}
          </span>
        </p>
      ) : null}
      {note && state !== "replayed" ? <p className="m-0 ml-8 font-mono text-xs leading-4 font-medium text-muted-foreground">{note}</p> : null}
      {usage ? (
        <p className="m-0 ml-8 font-mono text-xs leading-4 font-medium text-muted-foreground" data-testid="agent-usage">
          {usage.steps} model steps · {usage.inputTokens.toLocaleString("en-AU")} input and {usage.outputTokens.toLocaleString("en-AU")} output tokens
          {usage.reasoningTokens ? ` (${usage.reasoningTokens.toLocaleString("en-AU")} thinking)` : ""} · {(usage.ms / 1000).toFixed(1)} s
        </p>
      ) : null}
    </div>
  );
}
