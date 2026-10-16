import "server-only";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";

/**
 * A deterministic stand-in for the gateway model on a learn run, used only in offline mode (e2e and CI; never in
 * production) and in tests. Like the real one it investigates first (artists your fans like, the crowd at a usual pitch,
 * who is rising), looks up songs for the best artists, then finishes with songIds from top_tracks. It reads the history
 * block in its prompt and says what it saw, so a test can show the history reached the model.
 * Scenarios exercise the guardrails: `repeat`, `invented-numbers`, `never-finish`, `lazy`, `fail`.
 */
type PromptMessage = { role: string; content: unknown };
type ToolResult = { type: "tool-result"; toolName: string; output: { type: string; value: unknown } };
type Call = { toolName: string; input: unknown };
type Move = { reasoning?: string; text: string; calls: Call[] };
type Offered = { name: string; inputSchema?: unknown };

export type LearnMockScenario = "investigate" | "repeat" | "invented-numbers" | "never-finish" | "lazy" | "fail";

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

/** Every call the mock model received: its user prompt and the tools it was offered. For tests (module state, reset per test). */
export const mockLearnerCalls: { prompt: string; tools: string[] }[] = [];
export const resetMockLearnerCalls = () => void (mockLearnerCalls.length = 0);

function toolResults(prompt: PromptMessage[]): ToolResult[] {
  return prompt.filter((m) => m.role === "tool" && Array.isArray(m.content)).flatMap((m) => (m.content as ToolResult[]).filter((part) => part.type === "tool-result"));
}

function userText(prompt: PromptMessage[]): string {
  const user = prompt.find((m) => m.role === "user");
  return Array.isArray(user?.content) ? (user.content as { type: string; text?: string }[]).map((p) => p.text ?? "").join("\n") : String(user?.content ?? "");
}

const countOf = (text: string, label: RegExp) => Number(label.exec(text)?.[1] ?? 0);

/** What the history block says, for the mock's first note. */
export function historySeen(prompt: string) {
  return {
    learned: countOf(prompt, /Learned from earlier runs \((\d+)\)/),
    pending: countOf(prompt, /On your To learn list, not learned yet \((\d+)\)/),
    dismissed: countOf(prompt, /Dismissed, never suggest again \((\d+)\)/),
    firstRun: /Earlier runs: none/.test(prompt),
    firstLearned: /Learned from earlier runs \(\d+\): ([^\n(]+?) \(/.exec(prompt)?.[1] ?? null,
  };
}

type Artist = { artistId: string; name: string; alreadyInPlaylist?: boolean };
const value = <T>(r: ToolResult | undefined) => r?.output.value as T | undefined;
const isOk = (r: ToolResult) => r.output.type !== "error-text" && r.output.type !== "error-json";

function finish(results: ToolResult[], scenario: LearnMockScenario, rejections: number, learned: string | null): Move {
  const songs = results.filter((r) => r.toolName === "top_tracks" && isOk(r)).flatMap((r) => value<{ songs?: { songId: string; artist: string; artistId: string }[] }>(r)?.songs ?? []);
  const perArtist = new Map<string, number>();
  const chosen = songs.filter((s) => {
    const n = perArtist.get(s.artistId) ?? 0;
    if (n >= 2) return false;
    perArtist.set(s.artistId, n + 1);
    return true;
  }).slice(0, 6);
  const picks = chosen.map((s, i) => ({
    songId: s.songId,
    reason: scenario === "invented-numbers" ? `Mock reason: about 98765 people like ${s.artist}.` : `Mock reason: fans of your songs like ${s.artist}, and your crowds do too.`,
    ...(i === 0 && learned ? { buildsOn: learned } : {}),
  }));
  const bad = scenario === "repeat" && rejections === 0 ? [{ songId: "s-999", reason: "Trust me." }, ...picks] : picks;
  return {
    text: "I have enough to suggest songs.",
    calls: [{ toolName: "finish_suggestions", input: { picks: bad, summary: "Mock summary (offline test mode).", notes: ["Offline test mode: the reasons come from a mock model."] } }],
  };
}

/** The next move, from the tool results so far and the tools offered. */
export function nextMove(allResults: ToolResult[], offered: Offered[], prompt: string, scenario: LearnMockScenario): Move | null {
  // A call the gate turned away doesn't count as a look: the model goes on to investigate.
  const results = allResults.filter((r) => !(r.toolName === "top_tracks" && !isOk(r) && /isn't open yet|unavailable tool/.test(JSON.stringify(r.output.value))));
  const names = offered.map((t) => t.name);
  const can = (name: string) => names.length === 0 || names.includes(name);
  const ok = (name: string) => results.filter((r) => r.toolName === name && isOk(r));
  const tried = (name: string) => results.some((r) => r.toolName === name);
  const rejections = results.filter((r) => r.toolName === "finish_suggestions" && (r.output.value as { accepted?: boolean } | undefined)?.accepted === false).length;
  const seen = historySeen(prompt);
  const nothingToResearch = !can("related_artists");

  // Wrapping up: only top_tracks and/or finish_suggestions are offered.
  if (nothingToResearch) {
    if (scenario === "never-finish") return null;
    if (!ok("top_tracks").length && can("top_tracks")) return null;
    return finish(results, scenario, rejections, seen.firstLearned);
  }
  if (scenario === "never-finish") return { text: "Looking at artists again.", calls: [{ toolName: "related_artists", input: { take: 5 + results.length } }] };
  if (scenario === "lazy" && !allResults.length) return { text: "Going straight to songs.", calls: [{ toolName: "top_tracks", input: { artistIds: ["nobody"], perArtist: 2 } }] };

  if (!tried("related_artists")) {
    const text = seen.firstRun
      ? "This is your first run, so I'll start with the artists your fans also like."
      : `The history lists ${seen.learned} learned, ${seen.pending} to learn and ${seen.dismissed} dismissed, so I'll steer clear of those and start with artists your fans also like.`;
    return { reasoning: "Starting from the act's own taste keeps the suggestions close to what they can already sing.", text, calls: [{ toolName: "related_artists", input: { take: 12 } }] };
  }
  const related = value<{ artists?: Artist[] }>(ok("related_artists")[0])?.artists ?? [];
  const fresh = related.filter((a) => !a.alreadyInPlaylist);

  if (!tried("crowd_at") && can("crowd_at")) {
    const crowdTool = offered.find((t) => t.name === "crowd_at");
    const choices = ((crowdTool?.inputSchema as { properties?: { pitch?: { enum?: string[] } } } | undefined)?.properties?.pitch?.enum ?? ["city"]) as string[];
    const rising = fresh.slice(0, 3).map((a) => a.artistId);
    return {
      text: `Checking the crowd at ${choices[0] === "city" ? "the city centre" : choices[0]}, and who is rising among the artists I found.`,
      calls: [{ toolName: "crowd_at", input: { pitch: choices[0], take: 8 } }, ...(rising.length && can("rising") ? [{ toolName: "rising", input: { artistIds: rising } }] : [])],
    };
  }

  // Songs: the artists that fit both the act and the crowd first. If an artist's songs are all spoken for (the server says
  // so), look at the next ones, as a model reading the history would.
  const lookups = results.filter((r) => r.toolName === "top_tracks" && isOk(r));
  const got = lookups.flatMap((r) => value<{ songs?: unknown[] }>(r)?.songs ?? []).length;
  if (lookups.length === 0 || (got < 3 && lookups.length < 3 && can("top_tracks"))) {
    const crowd = value<{ artists?: Artist[] }>(ok("crowd_at")[0])?.artists ?? [];
    const crowdIds = new Set(crowd.map((a) => a.artistId));
    const lookedUp = new Set(lookups.flatMap((r) => value<{ lookedUp?: string[] }>(r)?.lookedUp ?? []));
    const ranked = [...fresh, ...crowd.filter((a) => !a.alreadyInPlaylist && !fresh.some((f) => f.artistId === a.artistId))].filter((a) => !lookedUp.has(a.artistId));
    ranked.sort((a, b) => Number(crowdIds.has(b.artistId)) - Number(crowdIds.has(a.artistId)));
    const picked = ranked.slice(0, 3).map((a) => a.artistId);
    if (picked.length) return { text: "Looking up top songs by the artists that fit both the act and the crowd.", calls: [{ toolName: "top_tracks", input: { artistIds: picked, perArtist: 2 } }] };
  }
  return finish(results, scenario, rejections, seen.firstLearned);
}

let ids = 0;

function streamOf(move: Move | null) {
  const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
  const id = String(++ids);
  if (move?.reasoning) parts.push({ type: "reasoning-start", id: `r${id}` }, { type: "reasoning-delta", id: `r${id}`, delta: move.reasoning }, { type: "reasoning-end", id: `r${id}` });
  const text = move?.text ?? "I can't find a better answer than the data's.";
  parts.push({ type: "text-start", id: `t${id}` }, { type: "text-delta", id: `t${id}`, delta: text }, { type: "text-end", id: `t${id}` });
  for (const [i, call] of (move?.calls ?? []).entries()) {
    parts.push({ type: "tool-call", toolCallId: `mock-${call.toolName}-${id}-${i}`, toolName: call.toolName, input: JSON.stringify(call.input) });
  }
  parts.push({ type: "finish", usage, finishReason: { unified: move?.calls.length ? "tool-calls" : "stop", raw: undefined } });
  return { stream: convertArrayToReadableStream(parts as never[]) };
}

export function createMockLearner(scenario: LearnMockScenario = "investigate") {
  return new MockLanguageModelV4({
    modelId: "mock-learner",
    doStream: async (options) => {
      if (scenario === "fail") throw new Error("mock model failure");
      const offered = (options.tools ?? []).map((t) => ({ name: t.name, inputSchema: (t as { inputSchema?: unknown }).inputSchema }));
      const prompt = userText(options.prompt as PromptMessage[]);
      mockLearnerCalls.push({ prompt, tools: offered.map((t) => t.name) });
      return streamOf(nextMove(toolResults(options.prompt as PromptMessage[]), offered, prompt, scenario));
    },
  });
}
