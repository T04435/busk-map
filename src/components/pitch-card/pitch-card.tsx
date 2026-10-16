import { Plus } from "lucide-react";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import type { Plan, PlanPitch } from "@/lib/plan-schema";

const FACTORS: { key: keyof PlanPitch["factors"]; weight: keyof Plan["weights"]; label: string; color: string }[] = [
  { key: "taste", weight: "taste", label: "Taste affinity (Qloo)", color: "var(--chart-1)" },
  { key: "footfall", weight: "footfall", label: "Foot traffic for the slot", color: "var(--chart-2)" },
  { key: "places", weight: "places", label: "Busy places open nearby", color: "var(--chart-3)" },
  { key: "events", weight: "events", label: "Event crowds", color: "var(--chart-4)" },
  { key: "discovery", weight: "discovery", label: "Discovery bonus (hidden gem)", color: "var(--honey-deep)" },
  { key: "weatherPenalty", weight: "weather", label: "Weather penalty", color: "var(--chart-5)" },
];

const FOOTFALL_NOTE: Record<NonNullable<PlanPitch["footfallSource"]>, string> = {
  sensor: "",
  "nearby-sensors": " (estimated from nearby sensors)",
  "qloo-popularity": " (estimated from Qloo area popularity)",
};

const money = (n: number) => `A$${Math.round(n)}`;


const H3 = ({ children }: { children: React.ReactNode }) => <h4 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{children}</h4>;

/**
 * How one pitch's score adds up: each factor as a cell with its weight ("× 0.35"), and the personal tip-log bonus. The details sheet keeps
 * it at the foot, folded: the board's sheet body is the head, why, foot traffic, facts and setlist (PitchDetails).
 */
export function ScoreBreakdown({ pitch, weights }: { pitch: PlanPitch; weights?: Plan["weights"] }) {
  return (
    <section aria-label="Score breakdown" className="space-y-3">
      <H3>Score breakdown</H3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {FACTORS.map(({ key, weight, label, color }) => {
          const v = pitch.factors[key];
          const none = key === "discovery" && v === 0;
          return (
            <li key={key} className="flex items-center gap-3">
              <PercentCell value={v === null || none ? null : v * 100} size={40} label={label} />
              <span className="min-w-0 flex-1 text-sm">
                <span aria-hidden="true" className="mr-2 inline-block size-2.5" style={{ background: color }} />
                {label}
                {key === "footfall" && pitch.footfallSource ? FOOTFALL_NOTE[pitch.footfallSource] : ""}
                {key === "footfall" && pitch.discovery === "usual" ? " (shared with other buskers)" : ""}
                {none ? <span className="text-muted-foreground"> · none</span> : null}
              </span>
              {weights ? <span className="font-mono text-xs text-muted-foreground" title="Weight">× {weights[weight].toFixed(2)}</span> : null}
            </li>
          );
        })}
        {pitch.tip && (
          <li data-testid="tip-bonus" className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
            <span className="flex items-center gap-2">
              <Plus aria-hidden="true" className="size-4" />
              Your tip log: {pitch.tip.sessions} session{pitch.tip.sessions === 1 ? "" : "s"} here at {money(pitch.tip.perHour)} an hour, against your {money(pitch.tip.averagePerHour)} an hour average
            </span>
            <b className="font-mono">{pitch.tip.points > 0 ? `+${pitch.tip.points}` : "none"}</b>
          </li>
        )}
      </ul>
      {pitch.tip && (
        <p className="m-0 text-sm text-muted-foreground">
          {pitch.tip.points > 0
            ? `You earned ${Math.round(pitch.tip.lift * 100)}% more per hour here than on average, so the score includes a personal bonus (at most +5).`
            : "You earned less here than on average. Tips never lower a score; this pitch just gets no bonus."}
        </p>
      )}
    </section>
  );
}
