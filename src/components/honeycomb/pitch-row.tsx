import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";

/**
 * One pitch in two short lines: [rank] [name @ time] [score] over [badges] [Full details]. The first line is the button that
 * selects it (`aria-pressed`, `data-pitch-name`); the second holds its badges and the Full details link. A selected row gains a
 * ruled frame and an orange offset, so selection never relies on colour alone.
 */
export function PitchRow({
  rank,
  name,
  when,
  score,
  badges,
  selected,
  onSelect,
  onDetails,
  detailsRef,
  pitchId,
}: {
  rank: number;
  name: string;
  when?: string;
  score: number;
  badges?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  onDetails?: () => void;
  detailsRef?: React.Ref<HTMLButtonElement>;
  pitchId?: string;
}) {
  const main = (
    <>
      <RankTile n={rank} size="sm" quiet={!selected} />
      <span className="min-w-0 flex-1 text-left">
        <b className="block font-display text-[22px] leading-none font-extrabold uppercase break-words">{name}</b>
        {when ? <span className="font-mono text-xs font-bold tracking-[0.04em] text-muted-foreground">@ {when}</span> : null}
      </span>
      <PercentCell value={score} size={44} tone={selected ? "primary" : "default"} label="Score" />
    </>
  );
  return (
    <li data-slot="pitch-row" data-pitch-id={pitchId} className={cn("border-2 bg-card transition-shadow", selected ? "border-rule shadow-md" : "border-border")}>
      {onSelect ? (
        <button
          type="button"
          aria-pressed={Boolean(selected)}
          data-pitch-name={name}
          onClick={onSelect}
          className="flex min-h-tap w-full items-center gap-3 p-3 text-left hover:bg-secondary focus-visible:outline-offset-[-4px]"
        >
          {main}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3">{main}</div>
      )}
      {badges || onDetails ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="flex flex-wrap items-center gap-2">{badges}</span>
          {onDetails ? (
            <button
              type="button"
              ref={detailsRef}
              onClick={onDetails}
              data-testid="pitch-details-open"
              className="inline-flex min-h-tap items-center gap-1 px-1 font-bold underline underline-offset-3 hover:decoration-2"
            >
              Full details <span className="sr-only">for {name}</span>
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
