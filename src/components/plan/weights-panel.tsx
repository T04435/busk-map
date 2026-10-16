import type { Plan } from "@/lib/plan-schema";

const LABELS: Record<keyof Plan["weights"], { label: string; color: string }> = {
  taste: { label: "Taste affinity (Qloo heatmap)", color: "var(--chart-1)" },
  footfall: { label: "Foot traffic for the slot (city sensors)", color: "var(--chart-2)" },
  places: { label: "Busy places open nearby (Qloo)", color: "var(--chart-3)" },
  events: { label: "Event crowds arriving or leaving (Ticketmaster)", color: "var(--chart-4)" },
  discovery: { label: "Discovery bonus: hidden gems with a strong taste fit", color: "var(--honey-deep)" },
  weather: { label: "Weather penalty (Open-Meteo)", color: "var(--chart-5)" },
};

/** How pitches are scored, with the weights used for this plan: a stacked bar, the weights in mono, and the top-3 spacing rule. */
export function WeightsPanel({ weights }: { weights: Plan["weights"] }) {
  const keys = Object.keys(LABELS) as (keyof Plan["weights"])[];
  const total = keys.reduce((s, k) => s + weights[k], 0) || 1;
  return (
    <section aria-label="How pitches are scored" className="space-y-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="space-y-1">
        <h3 className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">How pitches are scored</h3>
        <p className="m-0 text-sm text-muted-foreground">The same weights for every pitch.</p>
        <p className="m-0 text-sm text-muted-foreground" data-testid="spacing-rule">
          The top 3 are at least 250 m apart, so each is a different pitch. A higher-scored pitch within 250 m of a pick is left out: its dot on the map says
          &ldquo;too close to&rdquo; that pick.
        </p>
      </header>
      <div role="img" aria-label={keys.map((k) => `${LABELS[k].label} ${Math.round((weights[k] / total) * 100)}%`).join(", ")} className="flex h-4 w-full border-2 border-rule">
        {keys.map((k) => (
          <i key={k} style={{ width: `${(weights[k] / total) * 100}%`, background: LABELS[k].color }} />
        ))}
      </div>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {keys.map((key) => (
          <div key={key} className="contents">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden="true" className="inline-block size-2.5 shrink-0" style={{ background: LABELS[key].color }} />
              {LABELS[key].label}
            </dt>
            <dd className="m-0 font-mono">{weights[key].toFixed(2)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
