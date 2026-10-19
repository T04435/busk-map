import { HexCell } from "@/components/honeycomb/hex-cell";
import type { Plan } from "@/lib/plan-schema";

const LABELS: Record<keyof Plan["weights"], { label: string; color: string }> = {
  taste: { label: "Taste affinity (Qloo heatmap)", color: "var(--chart-1)" },
  activity: { label: "Activity estimate for the slot (Qloo: popular places open nearby)", color: "var(--chart-2)" },
  events: { label: "Event crowds arriving or leaving (Ticketmaster)", color: "var(--chart-4)" },
  discovery: { label: "Discovery bonus: hidden gems with a strong taste fit", color: "var(--honey-deep)" },
  weather: { label: "Weather penalty (Open-Meteo)", color: "var(--chart-5)" },
};

/** How pitches are scored, with the weights used for this plan: the spacing rule, a stacked bar and every factor with its share (the DS WeightsPanel). */
export function WeightsPanel({ weights }: { weights: Plan["weights"] }) {
  const keys = Object.keys(LABELS) as (keyof Plan["weights"])[];
  const total = keys.reduce((s, k) => s + weights[k], 0) || 1;
  return (
    <section aria-label="How pitches are scored" className="border-2 border-rule bg-card p-4 md:p-6">
      <h3 className="m-0 mb-4 font-display text-2xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">How pitches are scored</h3>
      <p className="m-0 mb-4 flex items-center gap-3 border-[1.5px] border-dashed border-rule px-3 py-2.5 text-sm leading-5" data-testid="spacing-rule">
        <HexCell size={40} fontSize={11} className="font-mono font-bold">
          250 m
        </HexCell>
        <span>
          The top 3 are at least 250 m apart: a higher-scored pitch within 250 m of a pick is left out.
        </span>
      </p>
      <div role="img" aria-label={keys.map((k) => `${LABELS[k].label} ${Math.round((weights[k] / total) * 100)}%`).join(", ")} className="mb-4 flex h-4 gap-0.5">
        {keys.map((k) => (
          <i key={k} className="block" style={{ width: `${(weights[k] / total) * 100}%`, background: LABELS[k].color }} />
        ))}
      </div>
      <div className="grid gap-2.5">
        {keys.map((key) => (
          <div key={key} className="grid grid-cols-[12px_1fr_auto] items-center gap-2 text-[15px]">
            <span aria-hidden="true" className="size-3" style={{ background: LABELS[key].color }} />
            <span>{LABELS[key].label}</span>
            <b className="font-mono tabular-nums">{weights[key].toFixed(2)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
