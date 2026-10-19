/**
 * Plain wording for the Qloo activity estimate (client-safe). The estimate is a 0-1 relative level, never a head count.
 * The engine's math is in server/scoring/activity.ts; this file only names its results.
 */

/** Where an activity estimate came from: the heatmap's popularity, the popular places open in the slot, both, or neither. */
export type ActivityBasis = "heatmap+places" | "heatmap" | "places" | "none";

/** The level used when Qloo gave nothing to estimate from (shown as "no estimate", never as a quiet or a busy place). */
export const NEUTRAL_ACTIVITY = 0.5;

/** A level in one word: "Quiet" up to "Very busy". */
export function activityWord(level: number): string {
  if (level >= 0.8) return "Very busy";
  if (level >= 0.6) return "Busy";
  if (level >= 0.4) return "Moderately busy";
  if (level >= 0.2) return "Fairly quiet";
  return "Quiet";
}

/** "mornings", "afternoons", "evenings", "nights": a word for the hours a slot starts in. */
export function dayPartOf(startHour: number): "mornings" | "afternoons" | "evenings" | "nights" {
  if (startHour >= 21 || startHour < 5) return "nights";
  if (startHour >= 17) return "evenings";
  if (startHour >= 12) return "afternoons";
  return "mornings";
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** What the estimate is made of, for the parenthesis after the sentence. */
export function activitySourceNote(basis: ActivityBasis): string {
  switch (basis) {
    case "heatmap+places":
      return "estimate from Qloo: popular places open nearby and where activity concentrates";
    case "places":
      return "estimate from Qloo: popular places open nearby";
    case "heatmap":
      return "estimate from Qloo: where activity concentrates; opening hours unknown";
    default:
      return "no estimate: Qloo had no activity data for this area";
  }
}

/**
 * "Busy here on Friday evenings (estimate from Qloo: popular places open nearby)". With no data: "No activity estimate here
 * (…)": honest, and never "quiet".
 */
export function activitySentence(input: { level: number; basis: ActivityBasis; weekday: string; startHour: number }): string {
  if (input.basis === "none") return `No activity estimate here (${activitySourceNote("none")})`;
  const word = activityWord(input.level);
  return `${word} here on ${cap(input.weekday)} ${dayPartOf(input.startHour)} (${activitySourceNote(input.basis)})`;
}

/** A short clause for a window's reason: "busy, with popular places open nearby (estimate)". Empty when there is no estimate. */
export function activityPhrase(level: number, basis: ActivityBasis): string {
  const word = activityWord(level).toLowerCase();
  if (basis === "none") return "";
  if (basis === "heatmap") return `${word} area on Qloo's activity map (estimate)`;
  return `${word}, with popular places open nearby (estimate)`;
}
