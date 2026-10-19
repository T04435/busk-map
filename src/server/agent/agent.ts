import "server-only";
import { PERSONA_PROMPT } from "@/lib/agent-persona";
import { NO_SCORES_RULE } from "@/lib/plain-scores";
import { ToolLoopAgent, type LanguageModel, type StopCondition } from "ai";
import { describeSlot } from "@/lib/slot";
import type { Plan } from "@/lib/plan-schema";
import { fromToolOutputs, type ResearchTotals, type ToolResult } from "@/lib/research-totals";
import { withQlooUsage } from "@/server/adapters/qloo/usage";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { assemblePlan } from "./assemble";
import type { PlanContext } from "./context";
import { boundSongs, PLAN_PROMPT_SONGS } from "@/lib/plan-songs-bound";
import { createMockPlanner } from "./mock-model";
import { LIMITS, MODELS, PLANNER_PROVIDER_OPTIONS } from "./models";
import { AFTER_SCORING, AgentState, createTools, finishSchema, scoringOpen, TOOL_LABELS, TOOL_SOURCES } from "./tools";

export { finishSchema as aiTextSchema };

export class QlooUnavailableError extends Error {
  constructor() {
    super("Qloo is unavailable");
    this.name = "QlooUnavailableError";
  }
}

/**
 * Agent v2: the goal, the guardrails and the tools, but no fixed order.
 * Claude investigates first and forms its own shortlist; score_pitches stays
 * closed until it has (scoringOpen); then the engine scores everything and
 * Claude chooses, ranking against the engine only for a reason in the data.
 */
export const INSTRUCTIONS = `${PERSONA_PROMPT}

Your job here: you are Busk Map's planning agent. A street performer wants the three best pitches for one time slot, and why each crowd fits. You investigate with tools. Busk Map's scoring engine is the calculator: it scores every pitch, and you choose among the pitches it has scored.

How to work:
1. Investigate first. score_pitches stays closed until you have made at least 3 looks with taste_map, crowd_at, events_near, activity_at, busy_places or check_pitch, and at least one of them is taste_map, crowd_at or events_near. There is no fixed order: decide each next look from what you have found (a strong taste area, an event crowd leaving nearby, a corner worth an activity check at that hour, what is open nearby).
2. Form your own shortlist from what you find. Run check_pitch on each promising spot that isn't already a pitch (a square, laneway or corner the data points to, or a well-known busking spot), so the engine can score it.
3. Then call score_pitches and add the spots you checked. The engine scores its own pool and your additions with the same weights, and marks its own top 3.
4. Choose. Set the engine's ranking against your shortlist, and look closer where they disagree or scores are close (compare_crowds, or another look).
5. Finish with finish_plan: three pitchIds from score_pitches, best first and at least 250 m apart (score_pitches flags sameCornerAs), a why for each, a two-sentence summary and any data caveats. If finish_plan rejects your answer, fix what it says and call it again.

Ranking against the engine: keep the engine's order unless the data shows something its score can't see, such as an event crowd leaving next to a pitch in the slot, a crowd that fits this act better, or the places nearby being closed. Rank a pitch above one the engine scored higher, or pick one outside the engine's top 3, only for a reason you found in a tool result, and make that reason the first sentence of that pitch's why. Never re-rank on a hunch.

Before each tool call, write one short sentence saying what you will check next and why. Look only inside the city centre planning area. Point at places by pitchId, by name, or with coordinates from a tool result. You have about 10 tool calls. Don't repeat a call with the same inputs.

Rules:
- Never invent a number, a place, an event or a song. Every number you write must come from a tool result.
- ${NO_SCORES_RULE}
- Activity is a relative estimate from Qloo (popular places open nearby and where activity concentrates), never a count of people; event end times are estimates too: say so.
- Busk Map never claims a pitch is legal. Mention cautions when a tool lists them.
- Taste data is aggregate. Never describe an individual.
- Be brief and concrete. Australian English.`;

export function buildPrompt(ctx: PlanContext, matched: { query: string; match: string | null }[]): string {
  const { request } = ctx;
  const songs = boundSongs(ctx.songs$, PLAN_PROMPT_SONGS).map((s) => `${s.title} (${s.artist}${s.own ? ", own song" : ""})`).join("; ");
  const box = ctx.city.bbox;
  const found = matched.filter((m) => m.match);
  const missing = matched.filter((m) => !m.match).map((m) => m.query);
  return [
    `Performer: ${request.performer.name}.`,
    `Sounds like: ${request.performer.artists.join(", ")}. Qloo matched: ${found.map((m) => m.match).join(", ") || "none"}${missing.length ? `; no match for ${missing.join(", ")}` : ""}.`,
    // Only when the act has researched genres, so every older prompt is unchanged.
    ...(request.performer.genreTags?.length ? [`Their sound in Qloo genres: ${request.performer.genreTags.map((g) => g.name).join(", ")} (the local scene leads with the ones the city shares).`] : []),
    songs ? `Can play: ${songs}.` : "No song list given.",
    ctx.isAnyTime
      ? `City: ${ctx.city.name}. Date: ${ctx.weekday} ${request.slot.date}. No fixed time: the engine scores each pitch at its best 3-hour window that day, 10 am to 10 pm. Call best_hours and say each pitch's hours in its why. Permit: ${request.permit}.`
      : `City: ${ctx.city.name}. Slot: ${describeSlot(request.slot)} (${ctx.weekday}, hours ${ctx.slotFor({}).startHour} to ${ctx.slotFor({}).endHour}). Permit: ${request.permit}.`,
    `Planning area: latitude ${box.south} to ${box.north}, longitude ${box.west} to ${box.east}.`,
    ctx.isAnyTime ? "Find the three best pitches for this act on this day, each at its best hours, and explain why each crowd fits." : "Find the three best pitches for this act in this slot and explain why each crowd fits.",
  ].join("\n");
}

type ToolName = keyof ReturnType<typeof createTools>;
/** The tools offered before score_pitches opens. */
const INVESTIGATION_ONLY = (["taste_map", "crowd_at", "busy_places", "events_near", "activity_at", "check_pitch", "learn_these"] as ToolName[]).filter(
  (t) => !(AFTER_SCORING as readonly string[]).includes(t),
);

export type AgentEvents = {
  onNote?: (event: { kind: "reasoning" | "text"; text: string }) => void;
  onToolStart?: (event: { id: string; tool: string; label: string; source?: string; input: unknown }) => void;
  onToolEnd?: (event: { id: string; tool: string; ok: boolean; summary: string; output: unknown }) => void;
  /** Running research totals over the finished tool calls so far, after each tool-end. */
  onTotals?: (totals: ResearchTotals) => void;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  steps: number;
  ms: number;
  stoppedBy: "finished" | "steps" | "tokens" | "no-answer";
};

type Limits = { maxSteps: number; tokenBudget: number; timeoutMs: number };

/** Tests swap the model and the limits. */
export type AgentOptions = { model?: LanguageModel; limits?: Partial<Limits> };

export type AgentResult = {
  plan: Plan;
  usage: Usage | null;
  /** The engine's own top 3 (no agent additions, no agent choice). */
  engineTop: { id: string; score: number }[];
  /** Claude's accepted top 3, or null when the plan fell back to the engine's. */
  agentTop: { id: string; score: number }[] | null;
};

/**
 * Run the agent loop and assemble the validated plan. Without the gateway,
 * or if the model fails, times out or never gives an acceptable answer, the
 * plan still completes from the engine with template explanations, labelled.
 */
export async function runPlanAgent(ctx: PlanContext, events: AgentEvents = {}, abortSignal?: AbortSignal, options: AgentOptions = {}): Promise<AgentResult> {
  // Qloo usage is counted for this busk only: the agent's tools and the engine's loads in this run (qloo/usage.ts).
  return withQlooUsage(async (qloo) => {
    const withQloo = (totals: ResearchTotals): ResearchTotals => ({ ...totals, qlooCalls: qloo.calls, qlooCacheHits: qloo.cacheHits });
    const result = await runAgent(ctx, { ...events, onTotals: events.onTotals && ((totals) => events.onTotals!(withQloo(totals))) }, abortSignal, options);
    if (result.plan.researchTotals) result.plan.researchTotals = withQloo(result.plan.researchTotals);
    return result;
  });
}

async function runAgent(ctx: PlanContext, events: AgentEvents, abortSignal: AbortSignal | undefined, options: AgentOptions): Promise<AgentResult> {
  // Qloo is required: check it before spending tokens.
  const artists = await ctx.artists();
  if (ctx.qlooFailed()) throw new QlooUnavailableError();
  const engineTop = async () => (await ctx.topPitches()).map((p) => ({ id: p.id, score: p.score }));
  const notes: string[] = [];
  // With no artist matched there is no taste to investigate: don't spend tokens.
  if ((await ctx.entityIds()).length === 0) {
    notes.push("Qloo couldn't match any of your artists, so the agent wasn't run and the reasons come from the data.");
    return { plan: await assemblePlan(ctx, null, { agentNotes: notes }), usage: null, engineTop: await engineTop(), agentTop: null };
  }

  const offline = ctx.adapters.offline;
  if (!offline && !options.model && !providerStatus().aiGateway) {
    notes.push("AI explanations are not configured here, so the reasons are generated from the data.");
    return { plan: await assemblePlan(ctx, null, { agentNotes: notes }), usage: null, engineTop: await engineTop(), agentTop: null };
  }

  const limits: Limits = { maxSteps: LIMITS.maxSteps, tokenBudget: LIMITS.tokenBudget, timeoutMs: LIMITS.agentTimeoutMs, ...options.limits };
  const state = new AgentState();
  const prompt = buildPrompt(
    ctx,
    artists.map((a) => ({ query: a.query, match: a.entity?.name ?? null })),
  );
  state.seen.add(prompt);
  state.seen.add(INSTRUCTIONS);
  const started = Date.now();
  let tokens = 0;
  type Tools = ReturnType<typeof createTools>;
  const finished: StopCondition<Tools> = () => state.answer !== null;
  const overBudget: StopCondition<Tools> = () => tokens >= limits.tokenBudget;
  const outOfSteps: StopCondition<Tools> = ({ steps }) => steps.length >= limits.maxSteps;

  let usage: Usage | null = null;
  const timeout = AbortSignal.timeout(limits.timeoutMs);
  // Every finished tool call, for the plan's research totals (counted now, before any pruning of stored steps).
  const toolResults: ToolResult[] = [];
  try {
    const agent = new ToolLoopAgent({
      model: options.model ?? (offline ? createMockPlanner() : MODELS.planner),
      instructions: INSTRUCTIONS,
      tools: createTools(ctx, state),
      stopWhen: [finished, overBudget, outOfSteps],
      maxOutputTokens: LIMITS.maxOutputTokensPerStep,
      providerOptions: PLANNER_PROVIDER_OPTIONS,
      // Until the looks are in, score_pitches (and what needs its pitchIds) isn't offered. Near the step cap or the
      // token budget only finish_plan is left, after a last score_pitches if nothing was scored yet.
      prepareStep: ({ stepNumber }) => {
        // Unscored, wrapping up takes two steps (score, finish), so it starts earlier on tokens.
        const wrap = stepNumber >= limits.maxSteps - 2 || tokens >= limits.tokenBudget * (state.scored ? 0.75 : 0.6);
        if (wrap) {
          state.wrappingUp = true;
          if (!state.scored && stepNumber < limits.maxSteps - 1) {
            return { activeTools: ["score_pitches", "finish_plan"], instructions: `${INSTRUCTIONS}\n\nYour research budget is used up: call score_pitches now (add any spots you checked), then finish_plan.` };
          }
          return { activeTools: ["finish_plan"], instructions: `${INSTRUCTIONS}\n\nYour research budget is used up: call finish_plan now with what you have.` };
        }
        if (!state.scored && !scoringOpen(state)) return { activeTools: INVESTIGATION_ONLY };
        return {};
      },
    });
    const result = await agent.stream({
      prompt,
      abortSignal: AbortSignal.any([timeout, ...(abortSignal ? [abortSignal] : [])]),
    });
    // Notes stream as whole blocks: Claude's reasoning summary and the sentence it writes before a call.
    const buffers = new Map<string, { kind: "reasoning" | "text"; text: string }>();
    const flush = (key: string) => {
      const b = buffers.get(key);
      buffers.delete(key);
      const text = b?.text.trim();
      if (b && text) events.onNote?.({ kind: b.kind, text });
    };
    const unshown = new Set<string>();
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    let steps = 0;
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "reasoning-start":
          buffers.set(`r:${part.id}`, { kind: "reasoning", text: "" });
          break;
        case "text-start":
          buffers.set(`t:${part.id}`, { kind: "text", text: "" });
          break;
        case "reasoning-delta": {
          const b = buffers.get(`r:${part.id}`);
          if (b) b.text += part.text;
          break;
        }
        case "text-delta": {
          const b = buffers.get(`t:${part.id}`);
          if (b) b.text += part.text;
          break;
        }
        case "reasoning-end":
          flush(`r:${part.id}`);
          break;
        case "text-end":
          flush(`t:${part.id}`);
          break;
        case "tool-call":
          // A call whose input the model garbled (live: events_near sent with an empty input) is not a look the performer
          // should see as "failed": the model gets the error back and retries, so the step is not shown.
          if (part.invalid) {
            unshown.add(part.toolCallId);
            log.warn("agent sent a tool call with unusable input; the model is told and retries", { tool: part.toolName });
            break;
          }
          for (const key of [...buffers.keys()]) flush(key);
          events.onToolStart?.({ id: part.toolCallId, tool: part.toolName, label: TOOL_LABELS[part.toolName] ?? part.toolName, source: TOOL_SOURCES[part.toolName], input: part.input });
          break;
        case "tool-result": {
          const output = part.output as { summary?: unknown; accepted?: boolean } | undefined;
          const ok = part.toolName !== "finish_plan" || output?.accepted === true;
          toolResults.push({ tool: part.toolName, ok, output: part.output });
          events.onToolEnd?.({ id: part.toolCallId, tool: part.toolName, ok, summary: typeof output?.summary === "string" ? output.summary : "Done", output: part.output });
          events.onTotals?.(fromToolOutputs(toolResults));
          break;
        }
        case "tool-error": {
          if (unshown.has(part.toolCallId)) break;
          const message = part.error instanceof Error ? part.error.message : String(part.error);
          toolResults.push({ tool: part.toolName, ok: false });
          events.onToolEnd?.({ id: part.toolCallId, tool: part.toolName, ok: false, summary: message.slice(0, 300), output: { error: message.slice(0, 600) } });
          events.onTotals?.(fromToolOutputs(toolResults));
          break;
        }
        case "finish-step":
          steps++;
          inputTokens += part.usage.inputTokens ?? 0;
          outputTokens += part.usage.outputTokens ?? 0;
          reasoningTokens += part.usage.outputTokenDetails?.reasoningTokens ?? 0;
          tokens = inputTokens + outputTokens;
          break;
        case "error":
          throw part.error instanceof Error ? part.error : new Error(String(part.error));
        case "abort":
          throw Object.assign(new Error(timeout.aborted ? "agent timeout" : "agent aborted"), { name: timeout.aborted ? "TimeoutError" : "AbortError" });
        default:
          break;
      }
    }
    for (const key of [...buffers.keys()]) flush(key);
    const stoppedBy: Usage["stoppedBy"] = state.answer ? "finished" : tokens >= limits.tokenBudget ? "tokens" : steps >= limits.maxSteps ? "steps" : "no-answer";
    usage = { inputTokens, outputTokens, reasoningTokens, steps, ms: Date.now() - started, stoppedBy };
    log.info("agent finished", { ...usage, model: options.model ? "custom" : offline ? "mock" : MODELS.planner });
  } catch (error) {
    log.error("agent failed; using the engine's plan", { error: error instanceof Error ? error.message : "unknown" });
    const timedOut = timeout.aborted || (error instanceof Error && error.name === "TimeoutError");
    notes.push(
      timedOut
        ? "The agent ran out of time, so this is the engine's plan with reasons generated from the data."
        : "The Hive was unavailable, so this is the engine's plan with reasons generated from the data.",
    );
    state.answer = null;
  }
  if (!state.answer && usage) {
    notes.push(
      usage.stoppedBy === "tokens" || usage.stoppedBy === "steps"
        ? "The agent reached its step or token limit without an answer the engine could accept, so this is the engine's plan with reasons generated from the data."
        : "The agent didn't give an answer the engine could accept, so this is the engine's plan with reasons generated from the data.",
    );
  }
  const plan = await assemblePlan(ctx, state.answer, {
    pool: [...state.pool.values()],
    agentNotes: notes,
    unverifiedNumbers: state.unverifiedNumbers,
    toolResults,
    model: offline && !options.model ? "mock" : "claude",
  });
  return {
    plan,
    usage,
    engineTop: await engineTop(),
    agentTop: plan.explanations === "ai" ? plan.pitches.map((p) => ({ id: p.id, score: p.score })) : null,
  };
}
