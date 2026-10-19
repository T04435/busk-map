/**
 * No raw scores in what people read (product rule, 20 Oct 2026). Pure and client-safe.
 * - `strengthWord` names a 0-1 strength in words ("Very strong" to "Weak"); the templates use it instead of "64/100" or "0.81".
 * - `plainScores` rewrites or strips what a model (or an old stored plan) wrote: "N/100", "N out of 100", "taste 0.81",
 *   "activity 0.7", a bare "(0.46)". Times, distances, rain chances, years and counts are left alone.
 */
import { activityWord } from "./activity";

/** A 0-1 strength in one word. */
export function strengthWord(value: number): "Very strong" | "Strong" | "Good" | "Some" | "Weak" {
  if (value >= 0.85) return "Very strong";
  if (value >= 0.7) return "Strong";
  if (value >= 0.5) return "Good";
  if (value >= 0.3) return "Some";
  return "Weak";
}

/** Lower-case for the middle of a sentence. */
export const strengthPhrase = (value: number) => strengthWord(value).toLowerCase();

const FACTORS = "taste|activity|events?|discovery";
const DECIMAL = String.raw`(?:[01]?\.\d+)`;

function factorWord(factor: string, value: number): string {
  return /^activity$/i.test(factor) ? activityWord(value).toLowerCase() : strengthPhrase(value);
}

/** Rewrites the raw numbers in a sentence into words, or drops them. Idempotent; text without such numbers is returned unchanged. */
export function plainScores(text: string): string {
  if (!/\d/.test(text)) return text;
  let out = text;
  // "taste 0.81", "activity 0.7", "taste match 0.9", "taste of 0.9": the factor keeps, its number becomes a word.
  out = out.replace(new RegExp(String.raw`\b(${FACTORS})(?:\s+(?:match|score|level|factor))?(?:\s+(?:of|at|is|was|=))?\s*[:=]?\s*(${DECIMAL})(?![\d/%])`, "gi"), (_m, factor: string, n: string) => `${factor} (${factorWord(factor, Number(n))})`);
  // A bare decimal in brackets: "The weather penalty (0.46) comes from…".
  out = out.replace(new RegExp(String.raw`\s*\(\s*${DECIMAL}\s*\)`, "g"), "");
  // "(61/100)", "(score 61/100)", "(61 out of 100)" on their own, or with a leftover comma list inside the brackets.
  out = out.replace(/\s*\(\s*(?:score\s+)?\d{1,3}\s*(?:\/|out of)\s*100\s*\)/gi, "");
  // "(61/100, taste (strong))": the number goes, the words stay.
  out = out.replace(/\(\s*(?:score\s+)?\d{1,3}\s*(?:\/|out of)\s*100\s*,\s*/gi, "(");
  // "scored it highest at 64/100, with…", "a score of 64/100", "64/100 for", "Taste match 64/100:".
  out = out.replace(/\s+(?:at|of|on|with|scoring|scored|a score of|score of|score)\s+\d{1,3}\s*(?:\/|out of)\s*100\b/gi, "");
  out = out.replace(/(\b[Tt]aste match|\b[Aa]ffinity|\b[Ss]core)\s+\d{1,3}\s*(?:\/|out of)\s*100\b/g, "$1");
  out = out.replace(/\b\d{1,3}\s*(?:\/|out of)\s*100\b,?\s*/gi, "");
  return out
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** The prompt rule every model-facing instruction carries: words, not scores. `plainScores` backs it up on what comes back. */
export const NO_SCORES_RULE =
  "Never write a score or a decimal for taste, activity, events, affinity or weather: no \"64/100\", \"0.81\", \"affinity 0.9\", \"taste 0.7\". Say it in words instead (strong taste match, busy, a close fit). You may write times, distances, rain chances, temperatures, years and counts.";
