import { cn } from "cn";

/** The text of a signed lean: "+41", "−30", "0". */
export function leanText(lean: number): string {
  const l = Math.max(-1, Math.min(1, lean));
  const n = Math.abs(Math.round(l * 100));
  return `${l > 0 && n > 0 ? "+" : l < 0 && n > 0 ? "−" : ""}${n}`;
}

/**
 * A signed lean (−1…1) either side of a centre line: + is above the average audience, − below. Not a percentage, so
 * not a PercentCell. Renders an `li`: put it in a `ul`.
 */
export function LeanBar({ label, lean, className }: { label: string; lean: number; className?: string }) {
  const l = Math.max(-1, Math.min(1, lean));
  const width = `${Math.round(Math.abs(l) * 50)}%`;
  const text = leanText(l);
  return (
    <li className={cn("grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-2 text-sm leading-5", className)}>
      <span className="truncate">{label}</span>
      <span className="relative h-2 bg-muted" role="img" aria-label={`${label}: ${text} against the average audience`}>
        <b aria-hidden="true" className="absolute -top-[3px] -bottom-[3px] left-1/2 -ml-px w-0.5 bg-rule" />
        <i
          aria-hidden="true"
          className={cn("absolute top-0 bottom-0", l < 0 ? "right-1/2 bg-muted-foreground" : "left-1/2 bg-foreground")}
          style={{ width }}
        />
      </span>
      <span className="text-right font-mono text-[13px] font-medium tabular-nums text-muted-foreground">{text}</span>
    </li>
  );
}
