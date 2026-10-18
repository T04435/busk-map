import { cn } from "cn";
import { PercentCell } from "@/components/honeycomb/percent-cell";

const SIZES = { sm: 34, md: 40 } as const;

/**
 * THE score: Fit, Affinity, taste match. A 0-100 value in a honeycomb cell (PercentCell is its internals; use this).
 * `label` names the value to screen readers ("Fit" reads "Fit 87 out of 100"); `caption` also shows it as text.
 */
export function ScoreCell({
  value,
  size = "md",
  label,
  caption,
  tone,
  className,
}: {
  /** 0-100, or null for "no data". */
  value: number | null | undefined;
  /** sm = 34px (inline, small rows), md = 40px. */
  size?: keyof typeof SIZES;
  label?: string;
  /** A visible caption next to the cell. */
  caption?: string;
  tone?: "primary" | "default" | "muted";
  className?: string;
}) {
  const cell = <PercentCell value={value} size={SIZES[size]} tone={tone} label={label ?? caption} />;
  if (!caption) return <span data-slot="score-cell" className={cn("inline-flex flex-none", className)}>{cell}</span>;
  return (
    <span data-slot="score-cell" className={cn("inline-flex items-center gap-2 text-sm leading-5", className)}>
      {cell}
      <span aria-hidden="true">{caption}</span>
    </span>
  );
}
