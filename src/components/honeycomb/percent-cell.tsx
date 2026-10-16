import { cn } from "cn";
import { HexCell, type HexTone } from "@/components/honeycomb/hex-cell";
import { ScoreRing, toPercent } from "@/components/honeycomb/score-ring";

/** What a screen reader hears for a percent cell: "Score 87 out of 100", "Affinity 82 out of 100", or "Score no data". */
export function percentLabel(value: number | null | undefined, label?: string): string {
  const prefix = label ? `${label} ` : "";
  if (value == null || Number.isNaN(value)) return `${prefix}no data`.trim();
  return `${prefix}${toPercent(value)} out of 100`;
}

/**
 * The one way to show a 0–100 value: scores, affinity, explainability, taste match, setlist fit. The pitch ring fills
 * inside a honeycomb cell, with the number in its core. Never "N/100" in text, never a bar with a number beside it.
 * Signed leans are not percentages: they stay LeanBar. Keep `size` at 32 or more so the number stays readable.
 */
export function PercentCell({
  value,
  size = 36,
  tone,
  label,
  className,
}: {
  /** 0–100, or null for "no data" (a dashed cell with a dash). */
  value: number | null | undefined;
  size?: number;
  /** `primary` for the selected or top item. */
  tone?: Extract<HexTone, "primary" | "default" | "muted">;
  /** Names the value to screen readers: "Score" reads "Score 87 out of 100". */
  label?: string;
  className?: string;
}) {
  const spoken = percentLabel(value, label);
  if (value == null || Number.isNaN(value)) {
    return (
      <HexCell size={size} tone="dashed" label={spoken} fontSize={Math.round(size * 0.36)} className={className}>
        –
      </HexCell>
    );
  }
  return (
    <HexCell size={size} tone={tone} label={spoken} className={cn("tabular-nums", className)}>
      <ScoreRing value={value} size={Math.round(size * 0.86)} label={false} />
    </HexCell>
  );
}

/** A labelled PercentCell for a list of meters (put them in a `ul.flex.flex-wrap`). `value` is 0–1. */
export function MeterBar({ label, value, size = 36, className }: { label: string; value: number | null | undefined; size?: number; className?: string }) {
  return (
    <li className={cn("inline-flex items-center gap-2 text-sm leading-[18px]", className)}>
      <PercentCell value={value == null ? null : value * 100} size={size} label={label} />
      <span>{label}</span>
    </li>
  );
}
