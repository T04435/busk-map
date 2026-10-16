import { cn } from "cn";

/** A 0–100 value clamped and rounded the way every score in the app is shown. */
export function toPercent(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

/**
 * The pitch ring as a gauge: an open 306-degree ring filling clockwise, the number in its core in condensed caps.
 * Prefer PercentCell, which puts this in a honeycomb cell and names the value for screen readers. `--ring-fill` and `--ring-track`
 * recolour it (PercentCell inverts it in a primary cell, where an orange ring on orange would vanish).
 */
export function ScoreRing({ value, size = 72, label = true, className }: { value: number; size?: number; label?: boolean; className?: string }) {
  const v = toPercent(value);
  const stroke = size * 0.11;
  const r = (size - stroke) / 2 - size * 0.06;
  const circumference = 2 * Math.PI * r;
  const span = 0.86; // the ring is open like the mark: 306 degrees of travel
  const length = circumference * span;
  const filled = (length * v) / 100;
  return (
    <span className={cn("relative inline-grid flex-none place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="block">
        <g transform={`rotate(-14 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${length} ${circumference}`} className="stroke-[var(--ring-track,var(--muted))]" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="stroke-[var(--ring-fill,var(--primary))] transition-[stroke-dasharray] duration-[var(--duration-slow)]"
          />
        </g>
      </svg>
      <span aria-hidden="true" className="absolute font-display font-extrabold tabular-nums" style={{ fontSize: Math.max(11, size * 0.36) }}>
        {v}
      </span>
      {label ? <span className="sr-only">{`Score ${v} out of 100`}</span> : null}
    </span>
  );
}
