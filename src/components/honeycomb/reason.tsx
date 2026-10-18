import { cn } from "cn";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { ScoreCell } from "@/components/honeycomb/score-cell";

/** `score` (0–100) is how much this artist explains the reason, shown as xs digits on its chip. */
export type ReasonArtist = { name: string; image?: string | null; score?: number | null };

/**
 * THE why line: the reason in plain words, and the artists behind it ("because fans of X") as small ArtistChips in one row
 * that wraps. Never truncated. Plain text only: a score never sits in prose (it is the row's one ScoreCell, or an InfoTag).
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
  return (
    <div data-slot="reason" className={cn("flex flex-col gap-2", className)}>
      <p className="m-0 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">{text}</p>
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
