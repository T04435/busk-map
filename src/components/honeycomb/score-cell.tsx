import { cn } from "cn";
import { HexCell, type HexTone } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { ScoreRing, toPercent } from "@/components/honeycomb/score-ring";

/** The cell sizes, never under 32px so the number stays readable. xs (inline digits) has no cell. */
const SIZES = { sm: 34, md: 40, lg: 56 } as const;

/** What a screen reader hears for a score: "Score 87 out of 100", "Affinity 82 out of 100", or "Score no data". */
export function scoreLabel(value: number | null | undefined, label?: string): string {
  const prefix = label ? `${label} ` : "";
  if (value == null || Number.isNaN(value)) return `${prefix}no data`.trim();
  return `${prefix}${toPercent(value)} out of 100`;
}

/**
 * THE score: Fit, Affinity, explainability, taste match, setlist fit. The one way to show a 0–100 value: the pitch ring fills
 * inside a honeycomb cell. Never "N/100" in text, never a bar with a number beside it; signed leans are not scores (LeanBar).
 * `size` sm 34 (small rows), md 40 (rows), lg 56 (pitch card, specimens); xs is small mono digits for the xs ArtistChip.
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
  /** 0–100, or null for "no data" (a dashed cell with the DS minus icon). */
  value: number | null | undefined;
  size?: keyof typeof SIZES | "xs";
  label?: string;
  /** A visible caption next to the cell. */
  caption?: string;
  /** `primary` for the selected or top item. */
  tone?: Extract<HexTone, "primary" | "default" | "muted">;
  className?: string;
}) {
  const spoken = scoreLabel(value, label ?? caption);
  if (size === "xs") {
    return (
      <span data-slot="score-cell" data-size="xs" className={cn("inline-flex flex-none font-mono text-xs leading-4 font-bold tabular-nums", className)}>
        <span aria-hidden="true">{value == null || Number.isNaN(value) ? "–" : toPercent(value)}</span>
        <span className="sr-only">{spoken}</span>
      </span>
    );
  }
  const px = SIZES[size];
  const cell =
    value == null || Number.isNaN(value) ? (
      <HexCell size={px} tone="dashed" label={spoken} fontSize={Math.round(px * 0.36)}>
        <Icon name="minus" size={Math.max(12, Math.round(px * 0.42))} />
      </HexCell>
    ) : (
      <HexCell
        size={px}
        tone={tone}
        label={spoken}
        // In a primary (selected or top) cell the ring inverts: ink on orange, with a faint ink track, so it never vanishes into the fill.
        className={cn("tabular-nums", tone === "primary" && "[--ring-fill:var(--primary-foreground)] [--ring-track:color-mix(in_srgb,var(--primary-foreground)_22%,transparent)]")}
      >
        <ScoreRing value={value} size={Math.round(px * 0.86)} label={false} />
      </HexCell>
    );
  if (!caption) return <span data-slot="score-cell" className={cn("inline-flex flex-none", className)}>{cell}</span>;
  return (
    <span data-slot="score-cell" className={cn("inline-flex items-center gap-2 text-sm leading-5", className)}>
      {cell}
      <span aria-hidden="true">{caption}</span>
    </span>
  );
}

/** A captioned ScoreCell in a list of meters (put them in a `ul.flex.flex-wrap`). `value` is 0–1; `noData` forces the no-data cell. */
export function MeterBar({ label, value, noData, className }: { label: string; value: number | null | undefined; noData?: boolean; className?: string }) {
  return (
    <li className={cn("inline-flex", className)}>
      <ScoreCell value={noData || value == null ? null : value * 100} size="sm" caption={label} />
    </li>
  );
}
