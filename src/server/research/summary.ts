import "server-only";
import { PERSONA_PROMPT } from "@/lib/agent-persona";
import { generateText, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { LEARN_MAX_PER_ARTIST, RESEARCH_SUMMARY_LIMITS } from "@/server/playlist/config";
import { LEARN_MODEL_ID } from "@/server/learn/models";
import type { LearnContext } from "@/server/learn/context";
import { fallbackAnswer } from "@/server/learn/fallback";
import { checkPicks, salvageAnswer, type AcceptedAnswer, type LearnState } from "@/server/learn/tools";

/**
 * Repertoire research step 9 (spec: "Summing up your act"): ONE short model call. Claude ranks the songs step 7 found and
 * writes one reason each, plus one plain paragraph on who the act is and who their crowd is. It never adds a song: picks
 * are songIds from this run's top tracks, checked by the learn run's own guardrails (checkPicks: this run's songs only,
 * no repeats, 2 per artist, every number from the data). If the model is unavailable, fails, or its words can't be
 * salvaged, the songs and the paragraph come from the data alone (templates), labelled "template".
 */
export type SummaryFacts = {
  act: string;
  spotifyGenres: string[];
  followers: number | null;
  description: string | null;
  audience: string[];
  genres: string[];
  soundsLike: string[];
  fansLove: string[];
  ageLean: string | null;
  genderLean: string | null;
};

export type SummaryResult = {
  accepted: AcceptedAnswer | null;
  text: string;
  by: "claude" | "mock" | "template";
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number; steps: number; ms: number; stoppedBy: string } | null;
};

export const SUMMARY_INSTRUCTIONS = `${PERSONA_PROMPT}

Your job here: you are Busk Map's Repertoire writer. A street performer has just had their act researched with Qloo's taste data. You only rank and explain; you never invent data.

1. From SONGS, choose the songs they should learn first, best first: up to ${RESEARCH_SUMMARY_LIMITS.maxPicks}, at most ${LEARN_MAX_PER_ARTIST} by one artist. Use songIds exactly as given. For each, one sentence a busker would find useful, naming the fans it comes from ("Fans of X and Y love this").
2. Write one plain paragraph (2 to 4 sentences) on who this act is and who their crowd is, from FACTS only.

Rules: every number you write must appear in FACTS or SONGS. Taste data is aggregate: never describe an individual. Be brief and concrete. Australian English.`;

const answerSchema = z.object({
  picks: z
    .array(z.object({ songId: z.string().max(20), reason: z.string().min(1).max(240) }))
    .max(8)
    .describe("songIds from SONGS, best first"),
  summary: z.string().min(1).max(RESEARCH_SUMMARY_LIMITS.summaryChars).describe("One plain paragraph about the act and its crowd"),
});
export type SummaryAnswer = z.infer<typeof answerSchema>;

const list = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** The paragraph from the data alone: names only, no numbers. */
export function templateParagraph(f: SummaryFacts): string {
  const parts = [
    f.soundsLike.length ? `${f.act} sounds like ${list(f.soundsLike.slice(0, 3))}.` : `${f.act} is researched from its Spotify profile.`,
    f.genres.length ? `Your sound sits in ${list(f.genres.slice(0, 3))}.` : "",
    f.ageLean ? `Your fans lean ${f.ageLean}${f.genderLean ? `, and ${f.genderLean}` : ""}.` : "",
    f.fansLove.length ? `They also love ${list(f.fansLove.slice(0, 3))}, so their songs are your best next covers.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function summaryPrompt(f: SummaryFacts, state: Pick<LearnState, "found" | "artists">): string {
  const songs = [...state.found.values()].map((s) => ({ songId: s.songId, title: s.title, artist: s.artist, year: s.year, fansOf: state.artists.get(s.artistId)?.because ?? [] }));
  return [`FACTS_JSON: ${JSON.stringify(f)}`, `SONGS_JSON: ${JSON.stringify(songs)}`, "", "Rank the songs and write the paragraph."].join("\n");
}

/** Offline and tests: a deterministic writer that reads the two JSON lines of the prompt. Names only, never a number. */
export function createMockResearchWriter(scenario: "ok" | "invented" | "fail" = "ok") {
  const usage = { inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 60, text: 60, reasoning: undefined } };
  return new MockLanguageModelV4({
    modelId: "mock-research-writer",
    doGenerate: async (options) => {
      if (scenario === "fail") throw new Error("mock model failure");
      const user = (options.prompt as { role: string; content: unknown }[]).find((m) => m.role === "user");
      const text = Array.isArray(user?.content) ? (user.content as { text?: string }[]).map((p) => p.text ?? "").join("\n") : String(user?.content ?? "");
      const grab = (label: string): unknown => {
        const m = new RegExp(`^${label}: (.*)$`, "m").exec(text);
        try {
          return m ? JSON.parse(m[1]) : null;
        } catch {
          return null;
        }
      };
      const facts = (grab("FACTS_JSON") ?? {}) as Partial<SummaryFacts>;
      const songs = (grab("SONGS_JSON") ?? []) as { songId: string; artist: string; fansOf: string[] }[];
      const per = new Map<string, number>();
      const picks = songs
        .filter((s) => {
          const n = per.get(s.artist) ?? 0;
          per.set(s.artist, n + 1);
          return n < LEARN_MAX_PER_ARTIST;
        })
        .slice(0, RESEARCH_SUMMARY_LIMITS.maxPicks)
        .map((s) => ({ songId: s.songId, reason: scenario === "invented" ? `Mock reason: 98765 fans love ${s.artist}.` : `Mock reason: fans of ${list(s.fansOf.slice(0, 2)) || "your music"} love ${s.artist}.` }));
      const summary = `Mock summary (offline test mode): ${facts.act ?? "This act"} sounds like ${list((facts.soundsLike ?? []).slice(0, 2)) || "no one yet"}, and your fans also love ${list((facts.fansLove ?? []).slice(0, 2)) || "other acts"}.`;
      return { content: [{ type: "text", text: JSON.stringify({ picks, summary }) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
  });
}

/** Keep the parts of the model's answer that pass the guardrails; anything else falls back to the data. */
export function acceptSummary(answer: SummaryAnswer, state: LearnState, ctx: LearnContext, facts: SummaryFacts, by: "claude" | "mock"): Omit<SummaryResult, "usage"> {
  const finish = { picks: answer.picks, summary: answer.summary, notes: [] as string[] };
  const paragraphOk = state.seen.unknownIn(answer.summary).length === 0;
  const text = paragraphOk ? answer.summary : templateParagraph(facts);
  if (state.found.size === 0) return { accepted: null, text, by: paragraphOk ? by : "template" };
  const problems = answer.picks.length ? checkPicks(finish, state, ctx) : [{ kind: "count" as const, message: "no picks" }];
  if (problems.length === 0) {
    const seen = new Set<string>();
    const picks = answer.picks.filter((p) => !seen.has(p.songId) && seen.add(p.songId)).map((p) => ({ songId: p.songId, reason: p.reason, buildsOn: null, templated: false }));
    return { accepted: { picks, summary: text, notes: [] }, text, by: paragraphOk ? by : "template" };
  }
  const salvaged = salvageAnswer(finish, state, ctx);
  if (salvaged) return { accepted: { ...salvaged, summary: text }, text, by: paragraphOk ? by : "template" };
  const data = fallbackAnswer(state);
  return { accepted: data ? { ...data, summary: text } : null, text, by: "template" };
}

/** Step 9. `model` overrides the choice (tests); offline uses the mock writer; with no gateway the data alone answers. */
export async function summarise(facts: SummaryFacts, state: LearnState, ctx: LearnContext, options: { offline: boolean; model?: LanguageModel; signal?: AbortSignal }): Promise<SummaryResult> {
  const started = Date.now();
  const model: LanguageModel | null = options.model ?? (options.offline ? createMockResearchWriter() : providerStatus().aiGateway ? LEARN_MODEL_ID : null);
  const by = options.model || options.offline ? "mock" : "claude";
  const prompt = summaryPrompt(facts, state);
  state.seen.add(prompt);
  const fromData = (stoppedBy: string): SummaryResult => {
    const data = fallbackAnswer(state);
    const text = templateParagraph(facts);
    return { accepted: data ? { ...data, summary: text } : null, text, by: "template", usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, steps: 0, ms: Date.now() - started, stoppedBy } };
  };
  if (!model) return fromData("model_unavailable");
  try {
    const result = await generateText({
      model,
      system: SUMMARY_INSTRUCTIONS,
      prompt,
      output: Output.object({ schema: answerSchema }),
      maxOutputTokens: RESEARCH_SUMMARY_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.any([AbortSignal.timeout(RESEARCH_SUMMARY_LIMITS.timeoutMs), ...(options.signal ? [options.signal] : [])]),
    });
    const usage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      reasoningTokens: result.usage.outputTokenDetails?.reasoningTokens ?? 0,
      steps: 1,
      ms: Date.now() - started,
      stoppedBy: "finished",
    };
    return { ...acceptSummary(result.output, state, ctx, facts, by), usage };
  } catch (error) {
    log.error("research summary failed; using the data", { error: error instanceof Error ? error.message : "unknown" });
    return fromData("error");
  }
}
