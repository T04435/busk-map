import { strengthPhrase } from "@/lib/plain-scores";
import { InfoTag } from "@/components/honeycomb/info-tag";
import { mentionsIn, type Mention } from "@/lib/mention";
import { Reason } from "@/components/honeycomb/reason";
import { splitReasonScores } from "@/lib/reason-scores";

/** A song's reason as SongRow's `reason` (its names drawn in place from `known`, U05) and `info` (one InfoTag per score): scores stay out of prose. */
export function reasonSlots(text: string | null | undefined, known: readonly Mention[] = []) {
  if (!text) return { reason: undefined, info: undefined };
  const { text: clean, scores } = splitReasonScores(text);
  return {
    reason: clean ? <Reason text={mentionsIn(clean, known)} /> : undefined,
    info: scores.length ? (
      <>
        {scores.map((s, i) => (
          <InfoTag key={`${s.label}${i}`}>
            {s.label}: {strengthPhrase(s.value / 100)}
          </InfoTag>
        ))}
      </>
    ) : undefined,
  };
}
