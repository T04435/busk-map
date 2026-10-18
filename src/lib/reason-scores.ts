/**
 * Scores stay out of prose (unify rule, 18 Oct 2026): a reason like "Crowd affinity for Paul Kelly: 100/100; from 2016…" shows
 * as the plain text "Crowd affinity for Paul Kelly; from 2016…" plus one InfoTag per score ("Affinity 100"). The engine's
 * reason string is unchanged (stored plans, the agent's tool output); only the display splits it.
 */
export type ReasonScore = { label: string; value: number };

const LABELS: [RegExp, string][] = [
  [/crowd affinity/i, "Affinity"],
  [/local scene/i, "Local scene"],
  [/taste match|rates .* fans/i, "Taste match"],
];
const labelOf = (clause: string) => LABELS.find(([re]) => re.test(clause))?.[1] ?? "Score";

export function splitReasonScores(text: string): { text: string; scores: ReasonScore[] } {
  const scores: ReasonScore[] = [];
  const clean = text
    .split(/(?<=;)\s*/)
    .map((clause) =>
      clause.replace(/\s*(?::\s*|\(\s*)(\d{1,3})\/100\s*\)?/g, (_m, n: string) => {
        scores.push({ label: labelOf(clause), value: Number(n) });
        return "";
      }),
    )
    .join(" ")
    .replace(/\s+;/g, ";")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text: clean, scores };
}
