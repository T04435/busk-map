/**
 * The agent's persona (research/agent-persona/persona.md, direction B, picked by the user on 17 Oct 2026): "Hive".
 *
 * ONE source for the display name and the voice. Client-safe, no I/O. Every user-facing "Claude researches / found / ranked"
 * goes through `modelName()` (lib/sources.ts), which reads AGENT_NAME from here; the copy helpers below are the lines more
 * than one component needs. In the product UI the agent is only ever called the Hive: no model name, credit or logo. The
 * system prompt below (server only) still tells the model to say what it is if it is asked.
 */

/** The persona's name. Mid-sentence it is "the Hive", at the start of one "The Hive", and as a tag "Hive". */
export const AGENT_NAME = "Hive";
export const AGENT_NAME_INLINE = `the ${AGENT_NAME}`;
export const AGENT_NAME_START = `The ${AGENT_NAME}`;

/** The agent's name in the form a sentence needs: "the Hive" mid-sentence, "The Hive" at its start, "Hive" as a tag. */
export function agentName(form: { start?: boolean; tag?: boolean } = {}): string {
  return form.tag ? AGENT_NAME : form.start ? AGENT_NAME_START : AGENT_NAME_INLINE;
}

/**
 * The persona block that opens every agent system prompt (busk agent, learn agent, Repertoire summary). It adds a voice and a
 * never-do list; it replaces none of a prompt's own rules.
 */
export const PERSONA_PROMPT = `You are Hive, Busk Map's research agent. Hive is a persona name: you run on Claude, made by Anthropic. If you are asked what you are, say so plainly. Never claim to be human, and never claim to be a different AI.

Your voice: calm, measured and complete sentences. In notes you say "we" (the sources and the checks, never staff: don't suggest that people checked anything by hand). Name the source in the same sentence as the fact, use counts ("9 of 12 places"), say "we couldn't" plainly, and stay calm when something fails. No bee puns, no jokes, no exclamation marks, no hype ("amazing", "guaranteed", "you'll smash it"), no crowd promises.

You never invent: no song, number, place, event or pitch that a tool didn't return. You never say a pitch is legal: say "not ruled out for your permit" and leave the check of the signs to the busker. You never hype.`;

/** The cells of the Hive mark: seven, one per step; BRAND draws it from `hiveProgress`. */
export const HIVE_CELLS = 7;

/** How many of the Hive's seven cells are filled: Math.round(done / total * 7), clamped to 0..7 (0 when total is 0). */
export function hiveProgress(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) return 0;
  return Math.min(HIVE_CELLS, Math.max(0, Math.round((done / total) * HIVE_CELLS)));
}

/**
 * The busk agent's step stream (AgentStep[] from lib/agent-steps.ts): done = tool steps whose `status` is no longer "running"
 * (done, failed, cut; note-only steps with `tool === null` don't count). The agent's tool calls are open-ended (about 10), so
 * total is `expected` (default BUSK_EXPECTED_STEPS) and grows to the count seen if the agent goes past it; `ended` (the run's
 * `end` event) fills the comb. Works for the learn stream too.
 */
export const BUSK_EXPECTED_STEPS = 8;
export function hiveProgressOfSteps(steps: readonly { tool: string | null; status: string }[], ended = false, expected = BUSK_EXPECTED_STEPS): number {
  if (ended) return HIVE_CELLS;
  const tools = steps.filter((s) => s.tool !== null);
  const done = tools.filter((s) => s.status !== "running").length;
  return Math.min(HIVE_CELLS - 1, hiveProgress(done, Math.max(expected, tools.length)));
}

/** The Repertoire research view model (lib/repertoire-research-view.ts): done = steps with status "done", "failed" or "skipped" over the steps this run covers (all 9, or 3 for "more"); an ended run is full. */
export function hiveProgressOfRepertoire(view: { phase: string; mode: "full" | "more" | null; steps: readonly { key: string; status: string }[] }): number {
  if (view.phase === "done") return HIVE_CELLS;
  if (view.phase === "empty") return 0;
  const covered = view.mode === "more" ? view.steps.filter((s) => ["fansLove", "learn", "summary"].includes(s.key)) : view.steps;
  const done = covered.filter((s) => s.status === "done" || s.status === "failed" || s.status === "skipped").length;
  return Math.min(HIVE_CELLS - 1, hiveProgress(done, covered.length));
}
