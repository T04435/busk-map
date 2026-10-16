/**
 * The "Agent vs engine" line above the plan: whether Claude kept the engine's
 * top 3, and for each position it changed, what it picked over what and why.
 * Pure and client-safe; the server computes the changes (agentChanges) and the
 * page formats them (agentVsEngineLines).
 */
import type { AgentChange } from "./plan-schema";
import { modelName, type ExplanationsModel } from "./sources";

type Pick = { id: string; name: string; score: number };

/** The first sentence of a why, at most `max` characters: the reason Claude gives for re-ranking. */
export function firstSentence(text: string, max = 240): string {
  const trimmed = text.trim().replaceAll(/\s+/g, " ");
  const match = trimmed.match(/^.+?[.!?](?=\s+["'(A-Z0-9]|$)/);
  const sentence = (match ? match[0] : trimmed).trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** Words that start a sentence but read lower-case after "because". */
const LOWER_AFTER_BECAUSE = new Set(["the", "it", "its", "it's", "this", "that", "these", "those", "a", "an", "here", "there", "more", "fewer", "less", "unlike", "with", "at", "on", "in", "closer", "busier", "quieter", "stronger", "both", "fans", "crowds", "people", "foot", "taste", "every", "most", "only"]);

export function becauseClause(reason: string): string {
  const text = reason.trim().replace(/[.!?]+$/, "");
  const word = text.split(/\s+/)[0] ?? "";
  return LOWER_AFTER_BECAUSE.has(word.toLowerCase()) ? `${text[0].toLowerCase()}${text.slice(1)}` : text;
}

/**
 * Each position where Claude's pick isn't the engine's pick for that position.
 * `engineOrder` is the engine's own ranking: its top 3 (spaced), then the rest
 * of its pool by score, so every engine pitch has one rank. A pitch outside it
 * (added by Claude) has rank null. The reason is the first sentence of the
 * pick's why.
 */
export function agentChanges(engineTop: Pick[], agentTop: Pick[], engineOrder: Pick[], whyOf: (id: string) => string | null): AgentChange[] {
  const rank = new Map(engineOrder.map((p, i) => [p.id, i + 1]));
  const ranked = (p: Pick) => ({ id: p.id, name: p.name, score: p.score, engineRank: rank.get(p.id) ?? null });
  return agentTop.flatMap((pick, i) => {
    const over = engineTop[i];
    if (over && over.id === pick.id) return [];
    const why = whyOf(pick.id);
    return [{ position: i + 1, pick: ranked(pick), over: over ? ranked(over) : null, reason: why ? firstSentence(why) : "" }];
  });
}

/**
 * The line's text: one sentence when the model kept the engine's top 3, else one line per changed position.
 * `model` names who did it: Claude, or the test model offline (B-010).
 */
export function agentVsEngineLines(agent: { changes: AgentChange[] }, model?: ExplanationsModel | null): string[] {
  const where = (p: AgentChange["pick"]) => (p.engineRank === null ? `added by ${modelName(model)}, score ${p.score}` : `engine #${p.engineRank}, score ${p.score}`);
  if (agent.changes.length === 0) return [`${modelName(model, "start")} kept the engine's top 3.`];
  return agent.changes.map(
    (c) =>
      `#${c.position}: ${modelName(model, "start")} picked ${c.pick.name} (${where(c.pick)})` +
      (c.over ? ` over ${c.over.name} (${where(c.over)})` : "") +
      (c.reason ? ` because ${becauseClause(c.reason)}.` : "."),
  );
}
