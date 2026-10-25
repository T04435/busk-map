import "server-only";
import { generateText, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { MODELS } from "@/server/agent/models";
import { providerStatus } from "@/server/env";
import type { RunUsage } from "@/server/learn/types";
import { log } from "@/server/log";

/**
 * The Hive's genre suggestions for the research ask: when the research found fewer than three genres it is sure of, ONE small model
 * call names up to three music genres from the act's name and the names of the artists it sounds like. Those names come from
 * Last.fm and the performer, never from Spotify (Spotify Developer Terms v10 §IV.2): no Spotify id, photo, genre or follower count
 * reaches the model. The answers are only suggestions: each must resolve to a Qloo genre tag by an exact name or a synonym, and
 * they are never preselected. Any failure means no suggestions.
 */
export const HIVE_GENRE_LIMITS = { maxOutputTokens: 200, timeoutMs: 8_000, max: 3 } as const;

export const HIVE_GENRE_INSTRUCTIONS = `You name music genres for a street performer's act. You are given the act's name and the names of artists it sounds like.
Answer up to ${HIVE_GENRE_LIMITS.max} music genres the act most likely plays, most specific first, as short lowercase genre names (for example "reggaeton", "indie folk", "latin trap").
A genre is a style of music: never a country, a city, a people, a language, an era or a mood. If you don't know, answer an empty list.`;

export type HiveGenreInput = { act: string; soundsLike: readonly string[] };

/** The user prompt: the act's name and its sound-alikes' names, nothing else. */
export function hiveGenrePrompt(input: HiveGenreInput): string {
  return [`ACT: ${input.act.slice(0, 80)}`, `SOUNDS_LIKE_JSON: ${JSON.stringify(input.soundsLike.slice(0, 10).map((n) => n.slice(0, 80)))}`, "", "Name up to 3 music genres."].join("\n");
}

const answerSchema = z.object({ genres: z.array(z.string().trim().min(2).max(40)).max(HIVE_GENRE_LIMITS.max) });

/** Offline and tests: fixed genres, one of them a place (dropped later) and one Qloo's mock has no tag for. */
export const MOCK_HIVE_GENRES = ["funk", "Cuba", "polka"] as const;
export function createMockGenreModel(scenario: "ok" | "fail" = "ok") {
  const usage = { inputTokens: { total: 40, noCache: 40, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 12, text: 12, reasoning: undefined } };
  return new MockLanguageModelV4({
    modelId: "mock-hive-genres",
    doGenerate: async () => {
      if (scenario === "fail") throw new Error("mock model failure");
      return { content: [{ type: "text", text: JSON.stringify({ genres: [...MOCK_HIVE_GENRES] }) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
  });
}

export type HiveGenreResult = { genres: string[]; by: "claude" | "mock" | null; usage: RunUsage | null };

/** The call. `model` overrides the choice (tests); offline uses the mock; with no AI gateway there is no call and no suggestion. */
export async function hiveGenres(input: HiveGenreInput, options: { offline: boolean; model?: LanguageModel; signal?: AbortSignal }): Promise<HiveGenreResult> {
  const started = Date.now();
  const model: LanguageModel | null = options.model ?? (options.offline ? createMockGenreModel() : providerStatus().aiGateway ? MODELS.planner : null);
  const by = options.model || options.offline ? "mock" : "claude";
  if (!model || !input.act.trim()) return { genres: [], by: null, usage: null };
  try {
    const result = await generateText({
      model,
      system: HIVE_GENRE_INSTRUCTIONS,
      prompt: hiveGenrePrompt(input),
      output: Output.object({ schema: answerSchema }),
      maxOutputTokens: HIVE_GENRE_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.any([AbortSignal.timeout(HIVE_GENRE_LIMITS.timeoutMs), ...(options.signal ? [options.signal] : [])]),
    });
    const usage: RunUsage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      reasoningTokens: result.usage.outputTokenDetails?.reasoningTokens ?? 0,
      steps: 1,
      ms: Date.now() - started,
      stoppedBy: "finished",
    };
    const genres = [...new Set(result.output.genres.map((g) => g.trim()).filter(Boolean))].slice(0, HIVE_GENRE_LIMITS.max);
    log.info("research hive genres", { genres, ms: usage.ms });
    return { genres, by, usage };
  } catch (error) {
    log.warn("research hive genres failed; no suggestions", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { genres: [], by: null, usage: null };
  }
}

/** Two runs' model usage as one (a paused run's genre call plus the ranking call after it). */
export function addUsage(a: RunUsage | null | undefined, b: RunUsage | null | undefined): RunUsage | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, reasoningTokens: a.reasoningTokens + b.reasoningTokens, steps: a.steps + b.steps, ms: a.ms + b.ms, stoppedBy: b.stoppedBy };
}
