import { Fragment } from "react";
import { cn } from "cn";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { ScoreCell } from "@/components/honeycomb/score-cell";

/** `score` (0–100) is how much this artist explains the reason, shown as xs digits on its chip. */
export type ReasonArtist = { name: string; image?: string | null; score?: number | null };

/**
 * THE why line: the reason in plain words, and the artists behind it ("because fans of X") as small ArtistChips in one row
 * that wraps. Never truncated. A score written as "87/100" in server prose becomes a ScoreCell, never text.
 */
export function Reason({
  text,
  because,
  scoreLabel = "Weight",
  className,
}: {
  text: string;
  because?: ReasonArtist[];
  /** Names the because scores to screen readers ("Weight 31 out of 100"). */
  scoreLabel?: string;
  className?: string;
}) {
  const parts = text.split(/(\d{1,3}\/100)/);
  return (
    <div data-slot="reason" className={cn("flex flex-col gap-2", className)}>
      <p className="m-0 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
        {parts.map((part, i) => {
          const m = /^(\d{1,3})\/100$/.exec(part);
          if (!m) return <Fragment key={i}>{part}</Fragment>;
          return <ScoreCell key={i} value={Number(m[1])} size="sm" className="mx-1 align-middle" />;
        })}
      </p>
      {because && because.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {because.map((a) => (
            <li key={a.name} className="inline-flex">
              <ArtistChip
                name={a.name}
                image={a.image}
                size="xs"
                state="static"
                score={a.score != null ? <ScoreCell value={a.score} size="xs" label={scoreLabel} /> : undefined}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
