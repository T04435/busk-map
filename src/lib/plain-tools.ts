/**
 * No tool names in what people read: the Hive's whys, summary and notes say what a step did, never which function did it
 * ("score_pitches reported …" reads "the scoring reported …"). Pure and client-safe. `plainTools` backs up NO_TOOL_NAMES_RULE.
 */

/** Each agent tool (server/agent/tools.ts) in plain words. */
export const TOOL_WORDS: Readonly<Record<string, string>> = {
  compare_areas: "the area comparison",
  taste_map: "the taste map",
  crowd_at: "the crowd check",
  busy_places: "the busy-places check",
  events_near: "the events check",
  activity_at: "the activity check",
  check_pitch: "the pitch check",
  score_pitches: "the scoring",
  best_hours: "the best-hours check",
  compare_crowds: "the crowd comparison",
  build_setlist: "the setlist",
  learn_these: "the songs-to-learn list",
  finish_plan: "the final plan",
};

/** Field names the model may echo from tool results. */
const FIELD_WORDS: Readonly<Record<string, string>> = {
  pitchIds: "pitches",
  pitchId: "pitch",
  sameCornerAs: "same-corner flag",
  engineTop3: "engine's top 3",
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TOOL_RE = new RegExp(String.raw`(\bthe\s+)?\x60?\b(${Object.keys(TOOL_WORDS).map(escape).join("|")})\b(?:\(\))?\x60?(\s+(?:tool|call|function|step))?`, "gi");
const FIELD_RE = new RegExp(String.raw`\x60?\b(${Object.keys(FIELD_WORDS).sort((a, b) => b.length - a.length).map(escape).join("|")})\b\x60?`, "g");
/** Any other snake_case identifier (two or more lower-case words joined by underscores), in backticks or not. */
const SNAKE_RE = /(?<![\w/.:@-])`?\b([a-z]+(?:_[a-z0-9]+)+)\b(?:\(\))?`?/g;

/** At the start of the text or of a sentence: the replacement starts with a capital. */
function atSentenceStart(text: string, offset: number): boolean {
  return /(^|[.!?]\s+|\n\s*|^["'(]\s*)$/.test(text.slice(0, offset));
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Rewrites tool names and function identifiers into plain words. Idempotent; text without any is returned unchanged. */
export function plainTools(text: string): string {
  if (!/[_`]|pitchId|sameCornerAs|engineTop3/.test(text)) return text;
  let out = text.replace(TOOL_RE, (m, _the: string | undefined, id: string, _suffix: string | undefined, offset: number, whole: string) => {
    const words = TOOL_WORDS[id.toLowerCase()];
    return atSentenceStart(whole, offset) ? cap(words) : words;
  });
  out = out.replace(FIELD_RE, (_m, id: string) => FIELD_WORDS[id]);
  out = out.replace(SNAKE_RE, (_m, id: string) => id.replace(/_/g, " "));
  return out.replace(/\bthe the\b/gi, (m) => m.slice(0, 3)).replace(/[ \t]{2,}/g, " ");
}

/** The prompt rule: no tool names in anything people read. `plainTools` backs it up on what comes back. */
export const NO_TOOL_NAMES_RULE =
  "Never write a tool or function name (such as score_pitches or best_hours), a field name (pitchId, sameCornerAs) or any identifier with underscores in anything people read: whys, the summary, notes, and the sentence before each tool call. Say what the step did in plain words instead (the scoring, the best-hours check, the crowd check).";
