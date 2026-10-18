import { InfoTag } from "@/components/honeycomb/info-tag";
import { Reason } from "@/components/honeycomb/reason";
import { splitReasonScores } from "@/lib/reason-scores";

/** A song's reason as SongRow's `reason` (plain text) and `info` (one InfoTag per score): scores stay out of prose. */
export function reasonSlots(text: string | null | undefined) {
  if (!text) return { reason: undefined, info: undefined };
  const { text: clean, scores } = splitReasonScores(text);
  return {
    reason: clean ? <Reason text={clean} /> : undefined,
    info: scores.length ? (
      <>
        {scores.map((s, i) => (
          <InfoTag key={`${s.label}${i}`}>
            {s.label} {s.value}
          </InfoTag>
        ))}
      </>
    ) : undefined,
  };
}
