import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/plan-schema";

const LABELS: Record<keyof Plan["weights"], string> = {
  taste: "Taste affinity (Qloo heatmap)",
  footfall: "Foot traffic for the slot (city sensors)",
  places: "Busy places open nearby (Qloo)",
  events: "Event crowds arriving or leaving (Ticketmaster)",
  weather: "Weather penalty (Open-Meteo)",
};

/** How pitches are scored, with the weights used for this plan. */
export function WeightsPanel({ weights }: { weights: Plan["weights"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How pitches are scored</CardTitle>
        <CardDescription>
          A weighted average of the factors with data, minus the weather penalty. Missing sources drop out instead of counting as zero.
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
