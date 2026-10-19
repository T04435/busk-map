import { Icon, type IconName } from "@/components/honeycomb/icon";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import type { Plan, PlanPitch } from "@/lib/plan-schema";

const FACTORS: { key: keyof PlanPitch["factors"]; weight: keyof Plan["weights"]; label: string; icon: IconName }[] = [
  { key: "taste", weight: "taste", label: "Taste affinity (Qloo)", icon: "music" },
  { key: "activity", weight: "activity", label: "Activity estimate for the slot (Qloo)", icon: "footfall" },
  { key: "events", weight: "events", label: "Event crowds", icon: "ticket" },
  { key: "discovery", weight: "discovery", label: "Discovery bonus (hidden gem)", icon: "gem" },
  { key: "weatherPenalty", weight: "weather", label: "Weather penalty", icon: "rain" },
];

/** What the activity estimate was made from, in the factor's note. */
const ACTIVITY_NOTE: Record<PlanPitch["activityBasis"], string> = {
  "heatmap+places": "Estimate: popular places open nearby, and where activity concentrates",
  places: "Estimate: popular places open nearby",
  heatmap: "Estimate: where activity concentrates; opening hours unknown",
  none: "No estimate: Qloo had no activity data here",
};

/**
 * How one pitch's score adds up (the DS ScoreBreakdown): the score in a big cell with "How this score adds up", then each factor as a
 * cell with its icon, label, note and weight ("× 0.35"). The details sheet keeps it at the foot, folded: the board's sheet body is
 * the head, why, activity, facts and setlist (PitchDetails).
 */
export function ScoreBreakdown({ pitch, weights }: { pitch: PlanPitch; weights?: Plan["weights"] }) {
  return (
    <section aria-label="Score breakdown" className="flex flex-col gap-4">
      <div className="flex flex-nowrap items-center gap-4">
        <ScoreCell value={pitch.score} size="lg" label="Score" />
        <div>
          <h4 className="m-0 font-display text-lg leading-[22px] font-extrabold tracking-[0.03em] uppercase">How this score adds up</h4>
          <p className="m-0 text-sm leading-5 text-muted-foreground">Each factor, times its weight. Bonuses come on top.</p>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0">
        {FACTORS.map(({ key, weight, label, icon }) => {
          const v = pitch.factors[key];
          const none = key === "discovery" && v === 0;
          const note = [
            key === "activity" ? ACTIVITY_NOTE[pitch.activityBasis] : "",
            key === "activity" && pitch.discovery === "usual" ? "Shared with other buskers" : "",
            none ? "None for this pitch" : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <ScoreCell value={v === null || none ? null : v * 100} size="md" label={label} />
              <span className="grid min-w-0 gap-0.5">
                <span className="flex items-center gap-1.5 font-sans text-[15px] leading-5 font-bold">
                  <Icon name={icon} size={16} />
                  {label}
                </span>
                {note ? <span className="text-[13px] leading-[18px] text-muted-foreground">{note}</span> : null}
              </span>
              {weights ? (
                <span className="font-mono text-[13px] leading-none text-muted-foreground" title="Weight">
                  × {weights[weight].toFixed(2)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
