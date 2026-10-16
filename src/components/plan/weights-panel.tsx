import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/plan-schema";

const LABELS: Record<keyof Plan["weights"], string> = {
  taste: "Taste affinity (Qloo heatmap)",
  footfall: "Foot traffic for the slot (city sensors)",
  places: "Busy places open nearby (Qloo)",
  events: "Event crowds arriving or leaving (Ticketmaster)",
  discovery: "Discovery bonus: hidden gems with a strong taste fit",
  weather: "Weather penalty (Open-Meteo)",
};

/** How pitches are scored, with the weights used for this plan. */
export function WeightsPanel({ weights }: { weights: Plan["weights"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>How pitches are scored</h2>
        </CardTitle>
        <CardDescription>
          Candidates come from your top Qloo taste cells, snapped to public spaces and checked against the council&apos;s busking rules. Each
          is scored as a weighted average of the factors with data, plus a small bonus for hidden gems, minus the weather penalty. At the well-known busking spots, foot traffic counts 85%: other buskers
          share that crowd. Missing
          sources drop out instead of counting as zero.
        </CardDescription>
        <CardDescription data-testid="spacing-rule">
          The top 3 are at least 250 m apart, so each is a different spot. A higher-scored pitch within 250 m of a pick is left out
          and marked &ldquo;too close to&rdquo; that pick under Other scored pitches.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          {(Object.keys(LABELS) as (keyof Plan["weights"])[]).map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{LABELS[key]}</dt>
              <dd>{weights[key].toFixed(2)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
