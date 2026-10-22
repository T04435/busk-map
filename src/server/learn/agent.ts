import { qlooBudgetSpent } from "@/server/adapters/qloo/budget";
import "server-only";
import { PERSONA_PROMPT } from "@/lib/agent-persona";
import { NO_SCORES_RULE } from "@/lib/plain-scores";
import { ToolLoopAgent, type LanguageModel, type StopCondition } from "ai";
import type { LearnEndCode, LearnModel, LearnTotals } from "@/lib/learn-schema";
import { fromLearnOutputs } from "@/lib/learn-totals";
import type { ToolResult } from "@/lib/research-totals";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { LEARN_LIMITS, LEARN_MAX_PICKS, LEARN_MIN_PICKS } from "@/server/playlist/config";
import type { LearnContext, MatchOutput } from "./context";
import { fallbackAnswer, rankArtists } from "./fallback";
import { formatHistory, historyForModel, readFromSpotify } from "./history";
import { nameKey } from "@/lib/text";
import { createMockLearner } from "./mock-model";
import { LEARN_MODEL_ID, LEARN_PROVIDER_OPTIONS } from "./models";
import { buildSuggestions, createLearnTools, joinSpotifyDisplay, LEARN_TOOL_LABELS, LEARN_TOOL_SOURCES, LearnState, songsOpen, type LearnTools } from "./tools";
import type { NewSuggestion } from "./types";

/**
 * The learn agent (docs/playlist-architecture.md §2): a second ToolLoopAgent, built like the busk agent in agent/agent.ts.
 * Qloo finds and scores the artists (the Repertoire's taste, the crowds at your pitches, who is rising), Last.fm supplies
 * their songs (never Spotify: its terms bar Spotify Content in an AI model; Spotify's covers and links join the picks
 * after the model call, joinSpotifyDisplay), and the model decides what to look at next, chooses the picks from the songs the tools
 * returned, and writes one reason per pick. It never adds a song: picks are songIds from this run's top_tracks.
 *
 * Two server steps run first and stream like any other step (match_playlist, history). If the model fails, times out or
 * never gives an acceptable answer, the deterministic fallback (fallback.ts) finishes the run from the data, labelled.
 */
export const LEARN_INSTRUCTIONS = `${PERSONA_PROMPT}

Your job here: you are Busk Map's song scout. A street performer wants new songs to learn: songs that fit their taste and voice, that the crowds where they busk will like, and that they haven't been offered before. You investigate with tools. You never invent a song: you choose only from songs that top_tracks returned in this run.

What you already know (in the prompt): the songs they can sing, the artists they sound like, their usual pitches, and the history of earlier runs: what was suggested, what they learned, what they dismissed. Build on it. If they learned a song, look for artists close to it. If they dismissed several songs by one kind of artist, look elsewhere. Never offer a song from the history again.

How to work:
1. Investigate first. top_tracks stays closed until you have used related_artists at least once and crowd_at or rising at least once. Decide each next look from what you found: a strong related artist, a crowd at one of their pitches, an artist who is rising.
2. Shortlist artists that fit both their taste and their crowds. Prefer artists who are not already in their Repertoire. No more than 2 songs by one artist.
3. Call top_tracks for your shortlist. It already leaves out songs from the history.
4. Finish with finish_suggestions: ${LEARN_MIN_PICKS} to ${LEARN_MAX_PICKS} songIds from top_tracks, best first, each with a one-sentence reason a busker would find useful. If it is rejected, fix what it says and call it again.

Before each tool call, write one short sentence saying what you will check next and why. You have about 8 tool calls. Don't repeat a call with the same inputs.

Rules:
- Every number in a reason must come from a tool result. Don't add numbers you weren't given.
- ${NO_SCORES_RULE}
- Say "builds on <song>" only for a song in their Learned list.
- Taste data is aggregate. Never describe an individual.
- Be brief and concrete. Australian English.`;

export function buildLearnPrompt(ctx: LearnContext, match: MatchOutput, history: string): string {
  const matched = match.artists.filter((a) => a.matched).map((a) => a.name);
  // An unmatched name known only from the act's songs read from Spotify is Spotify's spelling: not named (matched ones are Qloo's).
  const spotifyOnly = new Set(ctx.history.songs.filter(readFromSpotify).map((s) => nameKey(s.artist)));
  for (const s of ctx.history.songs) if (!readFromSpotify(s)) spotifyOnly.delete(nameKey(s.artist));
  for (const a of ctx.playlist.soundsLike) spotifyOnly.delete(nameKey(a.name));
  const unmatched = match.unmatched.filter((name) => !spotifyOnly.has(nameKey(name)));
  const sounds = ctx.playlist.soundsLike.map((a) => a.name);
  const pitches = ctx.pitches.map((p) => p.name);
  return [
    `Performer: ${ctx.playlist.actName ?? "the act"}.`,
    `Sounds like: ${sounds.join(", ") || "not given"}. Qloo matched: ${matched.join(", ") || "none"}${unmatched.length ? `; no match for ${unmatched.join(", ")}` : ""}.`,
    `City: ${ctx.city}. Today: ${ctx.today}. Usual pitches: ${pitches.join(", ") || "none yet (use 'city' for the crowd)"}.`,
    "",
    history,
    "",
    `Find ${LEARN_MIN_PICKS} to ${LEARN_MAX_PICKS} songs they should learn next, none from the history above.`,
  ].join("\n");
}

export type LearnAgentEvents = {
  onNote?: (event: { kind: "reasoning" | "text"; text: string }) => void;
  onToolStart?: (event: { id: string; tool: string; label: string; source?: string; input: unknown }) => void;
  onToolEnd?: (event: { id: string; tool: string; ok: boolean; summary: string; output: unknown }) => void;
  /** Running learn totals over the finished tool calls so far, after each tool-end. */
  onTotals?: (totals: LearnTotals) => void;
};

export type LearnUsage = { inputTokens: number; outputTokens: number; reasoningTokens: number; steps: number; ms: number; stoppedBy: string };
type Limits = { maxSteps: number; tokenBudget: number; timeoutMs: number };
/** Tests swap the model and the limits. */
export type LearnAgentOptions = { model?: LanguageModel; limits?: Partial<Limits> };

export type LearnAgentResult = {
  /** failed: nothing picked; done: the model's picks (or nothing new); fallback: the data's picks. */
  status: "failed" | "done" | "fallback";
  endCode: LearnEndCode | null;
  mode: "agent" | "mock" | "fallback" | "none";
  /** Who ranked: stored on the run. */
  model: LearnModel;
  picks: NewSuggestion[];
  summary: string | null;
  notes: string[];
  usage: LearnUsage | null;
  toolResults: ToolResult[];
};

type Exec = (input: unknown, options: unknown) => Promise<unknown>;

const INVESTIGATION = ["related_artists", "crowd_at", "rising", "crowd_profile"] as const;

/**
 * Run the learn agent for one Repertoire. The caller wraps this in `withQlooUsage`, passing its counter to the context, so
 * the match step and the tools share one Qloo budget (25 requests).
 */
export async function runLearnAgent(ctx: LearnContext, events: LearnAgentEvents = {}, abortSignal?: AbortSignal, options: LearnAgentOptions = {}): Promise<LearnAgentResult> {
  const started = Date.now();
  const state = new LearnState();
  const toolResults: ToolResult[] = [];
  const notes: string[] = [];
  const limits: Limits = { maxSteps: LEARN_LIMITS.maxSteps, tokenBudget: LEARN_LIMITS.tokenBudget, timeoutMs: LEARN_LIMITS.timeoutMs, ...options.limits };
  const offline = ctx.adapters.offline;
  const totalsNow = () => fromLearnOutputs(toolResults, { qlooCalls: ctx.usage.calls, qlooCacheHits: ctx.usage.cacheHits });
  const result = (r: Omit<LearnAgentResult, "toolResults" | "notes" | "usage"> & { usage?: LearnUsage | null }): LearnAgentResult => ({ ...r, usage: r.usage ?? null, notes, toolResults });

  // A step the server runs itself (no model), streamed like any other step.
  let serverSteps = 0;
  async function serverStep<T extends { summary: string }>(tool: string, input: unknown, run: () => Promise<T>): Promise<T | null> {
    const id = `srv-${++serverSteps}`;
    events.onToolStart?.({ id, tool, label: LEARN_TOOL_LABELS[tool] ?? tool, source: LEARN_TOOL_SOURCES[tool], input });
    try {
      const output = await run();
      toolResults.push({ tool, ok: true, output });
      events.onToolEnd?.({ id, tool, ok: true, summary: output.summary, output });
      events.onTotals?.(totalsNow());
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toolResults.push({ tool, ok: false });
      events.onToolEnd?.({ id, tool, ok: false, summary: message.slice(0, 300), output: { error: message.slice(0, 600) } });
      events.onTotals?.(totalsNow());
      return null;
    }
  }

  // 1. Match the Repertoire's artists on Qloo. Without Qloo's taste data there is nothing to scout.
  const match = { status: "qloo_unavailable" as "ok" | "qloo_unavailable" | "no_match" };
  const matched = await serverStep("match_playlist", {}, async () => {
    const m = await ctx.matchPlaylist();
    match.status = m.status;
    return m.output;
  });
  if (!matched || match.status !== "ok") {
    const code = match.status === "no_match" ? "no_match" : qlooBudgetSpent() ? "qloo_budget_spent" : "qloo_unavailable";
    return result({ status: "failed", endCode: code, mode: "none", model: offline ? "mock" : "claude", picks: [], summary: null });
  }

  // 2. The history, for the feed and the prompt (the full history filters top_tracks whatever the prompt shows).
  const h = ctx.history;
  const dismissedTotal = h.suggestions.filter((s) => s.status === "dismissed").length + h.dismissedKeys.length;
  const learnedTotal = h.suggestions.filter((s) => s.status === "learned").length;
  const pendingTotal = h.suggestions.filter((s) => s.status === "pending").length;
  await serverStep("history", {}, async () => ({
    summary: h.earlierRuns > 0 ? `${h.earlierRuns} earlier run${h.earlierRuns === 1 ? "" : "s"}: ${learnedTotal} learned, ${pendingTotal} to learn, ${dismissedTotal} dismissed` : "No earlier runs: this is the first",
    canSing: h.songs.filter((s) => s.state === "can_sing").length,
    pending: pendingTotal,
    learned: learnedTotal,
    dismissed: dismissedTotal,
    earlierRuns: h.earlierRuns,
    lastRunAt: h.lastRun ? new Date(h.lastRun.startedAt).toISOString() : null,
  }));

  // The act's own songs read from Spotify reach the prompt only as Last.fm lists them (historyForModel).
  const prompt = buildLearnPrompt(ctx, matched, formatHistory(await historyForModel(h, ctx.adapters)).text);
  state.seen.add(prompt);
  state.seen.add(LEARN_INSTRUCTIONS);
  const tools = createLearnTools(ctx, state);

  const model: LanguageModel | null = options.model ?? (offline ? createMockLearner() : providerStatus().aiGateway ? LEARN_MODEL_ID : null);
  const ranker = options.model || offline ? "mock" : "claude";
  let usage: LearnUsage | null = null;
  let endCode: LearnEndCode | null = null;
  const timeout = AbortSignal.timeout(limits.timeoutMs);

  if (!model) {
    notes.push("AI explanations are not configured here, so the songs and reasons come from the data.");
    endCode = "model_unavailable";
  } else {
    let tokens = 0;
    type T = LearnTools;
    const finished: StopCondition<T> = () => state.answer !== null || state.giveUp;
    const overBudget: StopCondition<T> = () => tokens >= limits.tokenBudget;
    const outOfSteps: StopCondition<T> = ({ steps }) => steps.length >= limits.maxSteps;
    try {
      const agent = new ToolLoopAgent({
        model,
        instructions: LEARN_INSTRUCTIONS,
        tools,
        stopWhen: [finished, overBudget, outOfSteps],
        maxOutputTokens: LEARN_LIMITS.maxOutputTokensPerStep,
        providerOptions: LEARN_PROVIDER_OPTIONS,
        // Until the looks are in, top_tracks (and finish_suggestions) aren't offered. Near the step or token cap only the
        // closing tools are left, with a line saying so.
        prepareStep: ({ stepNumber }) => {
          const wrap = stepNumber >= limits.maxSteps - 2 || tokens >= limits.tokenBudget * (state.found.size > 0 ? 0.75 : 0.6);
          if (wrap) {
            state.wrappingUp = true;
            const needSongs = state.found.size === 0 && stepNumber < limits.maxSteps - 1;
            return {
              activeTools: needSongs ? ["top_tracks", "finish_suggestions"] : ["finish_suggestions"],
              instructions: `${LEARN_INSTRUCTIONS}\n\nYour research budget is used up: ${needSongs ? "call top_tracks for your best artists, then " : ""}call finish_suggestions now with what you have.`,
            };
          }
          if (!songsOpen(state)) return { activeTools: [...INVESTIGATION] };
          if (state.found.size === 0) return { activeTools: [...INVESTIGATION, "top_tracks"] };
          return {};
        },
      });
      const stream = await agent.stream({ prompt, abortSignal: AbortSignal.any([timeout, ...(abortSignal ? [abortSignal] : [])]) });
      // Notes stream as whole blocks: the reasoning summary and the sentence written before a call.
      const buffers = new Map<string, { kind: "reasoning" | "text"; text: string }>();
      const flush = (key: string) => {
        const b = buffers.get(key);
        buffers.delete(key);
        const text = b?.text.trim();
        if (b && text) events.onNote?.({ kind: b.kind, text });
      };
      let inputTokens = 0;
      let outputTokens = 0;
      let reasoningTokens = 0;
      let steps = 0;
      for await (const part of stream.fullStream) {
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
            for (const key of [...buffers.keys()]) flush(key);
            events.onToolStart?.({ id: part.toolCallId, tool: part.toolName, label: LEARN_TOOL_LABELS[part.toolName] ?? part.toolName, source: LEARN_TOOL_SOURCES[part.toolName], input: part.input });
            break;
          case "tool-result": {
            const output = part.output as { summary?: unknown; accepted?: boolean } | undefined;
            const okResult = part.toolName !== "finish_suggestions" || output?.accepted === true;
            toolResults.push({ tool: part.toolName, ok: okResult, output: part.output });
            events.onToolEnd?.({ id: part.toolCallId, tool: part.toolName, ok: okResult, summary: typeof output?.summary === "string" ? output.summary : "Done", output: part.output });
            events.onTotals?.(totalsNow());
            break;
          }
          case "tool-error": {
            const message = part.error instanceof Error ? part.error.message : String(part.error);
            toolResults.push({ tool: part.toolName, ok: false });
            events.onToolEnd?.({ id: part.toolCallId, tool: part.toolName, ok: false, summary: message.slice(0, 300), output: { error: message.slice(0, 600) } });
            events.onTotals?.(totalsNow());
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
      const stoppedBy = state.answer ? "finished" : tokens >= limits.tokenBudget ? "tokens" : steps >= limits.maxSteps ? "steps" : "no-answer";
      usage = { inputTokens, outputTokens, reasoningTokens, steps, ms: Date.now() - started, stoppedBy };
      log.info("learn agent finished", { ...usage, model: options.model ? "custom" : offline ? "mock" : LEARN_MODEL_ID });
      if (!state.answer) endCode = "stopped";
    } catch (error) {
      const timedOut = timeout.aborted || (error instanceof Error && error.name === "TimeoutError");
      log.error("learn agent failed; using the data's picks", { error: error instanceof Error ? error.message : "unknown" });
      state.answer = null;
      endCode = timedOut ? "timeout" : "model_unavailable";
      usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, steps: 0, ms: Date.now() - started, stoppedBy: timedOut ? "timeout" : "error" };
    }
  }

  if (state.answer) {
    // Spotify's covers and links join the picks only now, after the model call: the model saw Last.fm's songs alone.
    await joinSpotifyDisplay(state, state.answer.picks.map((p) => p.songId), ctx);
    const picks = buildSuggestions(state.answer, state, ctx, ranker);
    notes.push(...state.answer.notes);
    return result({ status: "done", endCode: null, mode: ranker === "mock" ? "mock" : "agent", model: ranker === "mock" ? "mock" : "claude", picks, summary: state.answer.summary, usage });
  }

  // 3. The fallback: rank what the run found. If the model never got far, the server runs the looks itself.
  const run = async (name: keyof LearnTools, input: unknown) => serverStep(name, input, () => (tools[name].execute as unknown as Exec)(input, { toolCallId: `srv-${name}`, messages: [] }) as Promise<{ summary: string }>);
  if (state.artists.size === 0 && !ctx.qlooFailed) {
    await run("related_artists", { take: 20 });
    if (state.artists.size > 0) await run("crowd_at", { pitch: ctx.pitches[0]?.name ?? "city", take: 10 });
  }
  if (state.found.size === 0 && state.artists.size > 0) {
    const best = rankArtists(state).filter((a) => !state.looked.has(a.id)).slice(0, 4).map((a) => a.id);
    state.wrappingUp = true;
    if (best.length) await run("top_tracks", { artistIds: best, perArtist: 2 });
  }
  const accepted = fallbackAnswer(state);
  if (accepted) {
    await joinSpotifyDisplay(state, accepted.picks.map((p) => p.songId), ctx);
    return result({ status: "fallback", endCode: endCode ?? "stopped", mode: "fallback", model: "template", picks: buildSuggestions(accepted, state, ctx, "template"), summary: accepted.summary, usage });
  }
  const totals = totalsNow();
  if (state.artists.size === 0) return result({ status: "failed", endCode: qlooBudgetSpent() ? "qloo_budget_spent" : "qloo_unavailable", mode: "none", model: "template", picks: [], summary: null, usage });
  if (totals.songsChecked > 0 || state.coveredSeen > 0) return result({ status: "done", endCode: "nothing_new", mode: "fallback", model: "template", picks: [], summary: null, usage });
  return result({ status: "failed", endCode: endCode ?? null, mode: "none", model: "template", picks: [], summary: null, usage });
}
