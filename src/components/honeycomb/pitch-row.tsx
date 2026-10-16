import type { ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { cn } from "cn";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";

/**
 * The DS compact row, two lines and no rule between them: [rank hex] [NAME @ time] [score] over [badges] [Full details]. The first line is the button that
 * selects it (`aria-pressed`, `data-pitch-name`). A selected row is white with a ruled frame, the orange offset shadow, a solid rank tile and a filled score cell; the others have a quiet outlined tile (so selection never relies on colour alone).
 */
export function PitchRow({
  rank,
  name,
  when,
  window,
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
  /** Any time: this pitch's own best hours ("Best 6 pm–9 pm"), shown in place of `when`. */
  window?: string;
  score: number;
  badges?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  onDetails?: () => void;
  detailsRef?: React.Ref<HTMLButtonElement>;
  pitchId?: string;
}) {
  const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none";
  const time = window ? (
    <span className="flex-none font-mono text-xs leading-4 font-medium text-muted-foreground" data-testid="pitch-row-window">
      {window}
    </span>
  ) : when ? (
    <span className="flex-none font-mono text-xs leading-4 font-medium text-muted-foreground">@ {when}</span>
  ) : null;
  const main = (
    <>
      <RankTile n={rank} size="sm" quiet={!selected} />
      <span className="flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-left">
        <b className="min-w-0 truncate font-display text-[19px] leading-[22px] font-extrabold uppercase">{name}</b>
        {time}
      </span>
      <PercentCell value={score} size={40} tone={selected ? "primary" : "default"} label="Score" />
    </>
  );
  const top = "grid min-h-9 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-left";
  return (
    <li
      data-slot="pitch-row"
      data-pitch-id={pitchId}
      className={cn("grid gap-1.5 px-3 py-2", selected ? "border-2 border-rule bg-popover shadow-[4px_4px_0_var(--primary)]" : "border border-border bg-background")}
    >
      {onSelect ? (
        <button type="button" aria-pressed={Boolean(selected)} data-pitch-name={name} onClick={onSelect} className={cn(top, "cursor-pointer", FOCUS)}>
          {main}
        </button>
      ) : (
        <div className={top}>{main}</div>
      )}
      {badges || onDetails ? (
        <div className="flex items-center justify-between gap-2 pl-[42px]">
          <span className="flex flex-wrap items-center gap-1.5">{badges}</span>
          {onDetails ? (
            <button
              type="button"
              ref={detailsRef}
              onClick={onDetails}
              data-testid="pitch-details-open"
              className={cn(
                "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-sm font-mono text-xs leading-4 font-bold tracking-[0.06em] whitespace-nowrap text-foreground uppercase hover:text-signal-text",
                FOCUS,
              )}
            >
              Full details <span className="sr-only">for {name}</span>
              <Icon name="arrow-right" size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
