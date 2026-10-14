import "server-only";
import { isStepCount, Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import { describeSlot } from "@/lib/slot";
import type { Plan } from "@/lib/plan-schema";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { assemblePlan, type AiText } from "./assemble";
import type { PlanContext } from "./context";
import { createMockPlanner } from "./mock-model";
import { LIMITS, MODELS } from "./models";
import { createTools, TOOL_LABELS } from "./tools";

/** What the model may return. Words only; the engine owns numbers and places. */
export const aiTextSchema = z.object({
  summary: z.string().max(600).describe("Two sentences for the performer: where to play and why, from the tool results only."),
  pitches: z
    .array(
      z.object({
        pitchId: z.string().describe("A pitchId exactly as returned by score_pitches."),
        why: z.string().max(500).describe("Why this crowd: one or two sentences citing the evidence. Say 'estimated' for estimates."),
      }),
    )
    .max(3),
  notes: z.array(z.string().max(240)).max(5).describe("Data caveats, e.g. a widened search or a missing source."),
});

export class QlooUnavailableError extends Error {
  constructor() {
    super("Qloo is unavailable");
    this.name = "QlooUnavailableError";
  }
}

export const INSTRUCTIONS = `You are Busk Map's planning agent. You help a street performer choose where to play and what to play.

How to work:
- Start with resolve_repertoire. Then gather data with taste_map, footfall, busking_rules, busy_places, events, weather and local_artists (call several at once).
- Then call score_pitches, rising and build_setlists. crowd_profile is optional.
- Finish with the structured answer. Use only pitch ids returned by score_pitches, in the same order.

Rules:
- Never invent a number, a place, an event or a song. Only restate what the tools returned.
- Foot traffic and event exit times are estimates: say so.
- Busk Map never claims a pitch is legal. Mention cautions when a tool lists them.
- Taste data is aggregate. Never describe an individual.
- Pitches come from the performer's Qloo taste cells. When score_pitches marks one as a hidden gem, say why it beats the obvious spots (taste fit, less competition); when it is a usual spot, say buskers already go there.
- Be brief and concrete. Australian English.`;

export function buildPrompt(ctx: PlanContext): string {
  const { request } = ctx;
  const songs = request.performer.songs.map((s) => `${s.title} (${s.artist}${s.own ? ", own song" : ""})`).join("; ");
  return [
    `Performer: ${request.performer.name}.`,
    `Sounds like: ${request.performer.artists.join(", ")}.`,
    songs ? `Can play: ${songs}.` : "No song list given.",
    `City: ${ctx.city.name}. Slot: ${describeSlot(request.slot)}. Permit: ${request.permit}.`,
    "Plan the three best pitches and explain why each crowd fits.",
  ].join("\n");
}

export type AgentEvents = {
  onToolStart?: (event: { id: string; tool: string; label: string }) => void;
  onToolEnd?: (event: { id: string; tool: string; ok: boolean; summary: string }) => void;
};

type Usage = { inputTokens: number; outputTokens: number; steps: number };

/**
 * Run the agent loop and assemble the validated plan. Without the gateway
 * (or if the model fails), the plan still completes from the engine with
 * template explanations, labelled as such.
 */
export async function runPlanAgent(
  ctx: PlanContext,
  events: AgentEvents = {},
  abortSignal?: AbortSignal,
): Promise<{ plan: Plan; usage: Usage | null }> {
  // Qloo is required: check it before spending tokens.
  await ctx.artists();
  if (ctx.qlooFailed()) throw new QlooUnavailableError();
  // With no artist matched there is no taste to explain: don't spend tokens.
  if ((await ctx.entityIds()).length === 0) {
    ctx.notes.push("Qloo couldn't match any of your artists, so the agent wasn't run and the reasons come from the data.");
    return { plan: await assemblePlan(ctx, null), usage: null };
  }

  const offline = ctx.adapters.offline;
  if (!offline && !providerStatus().aiGateway) {
    ctx.notes.push("AI explanations are not configured here, so the reasons are generated from the data.");
    return { plan: await assemblePlan(ctx, null), usage: null };
  }

  let ai: AiText | null = null;
  let usage: Usage | null = null;
  try {
    const agent = new ToolLoopAgent({
      model: offline ? createMockPlanner() : MODELS.planner,
      instructions: INSTRUCTIONS,
      tools: createTools(ctx),
      output: Output.object({ schema: aiTextSchema }),
      stopWhen: isStepCount(LIMITS.maxSteps),
      maxOutputTokens: LIMITS.maxOutputTokensPerStep,
    });
    const result = await agent.generate({
      prompt: buildPrompt(ctx),
      abortSignal: abortSignal ?? AbortSignal.timeout(LIMITS.agentTimeoutMs),
      onToolExecutionStart: ({ toolCall }) => {
        events.onToolStart?.({ id: toolCall.toolCallId, tool: toolCall.toolName, label: TOOL_LABELS[toolCall.toolName] ?? toolCall.toolName });
      },
      onToolExecutionEnd: ({ toolCall, toolOutput }) => {
        const ok = toolOutput.type === "tool-result";
        const output = ok ? (toolOutput as { output?: { summary?: unknown } }).output : undefined;
        events.onToolEnd?.({
          id: toolCall.toolCallId,
          tool: toolCall.toolName,
          ok,
          summary: typeof output?.summary === "string" ? output.summary : ok ? "Done" : "Failed",
        });
      },
    });
    ai = result.output;
    usage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      steps: result.steps.length,
    };
    log.info("agent finished", { ...usage, model: offline ? "mock" : MODELS.planner });
  } catch (error) {
    log.error("agent failed; using template explanations", { error: error instanceof Error ? error.message : "unknown" });
    ctx.notes.push("The AI planner was unavailable, so the reasons are generated from the data.");
  }
  return { plan: await assemblePlan(ctx, ai), usage };
}
