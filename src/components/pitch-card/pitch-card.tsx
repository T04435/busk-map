import { Icon, type IconName } from "@/components/honeycomb/icon";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import type { Plan, PlanPitch } from "@/lib/plan-schema";

const FACTORS: { key: keyof PlanPitch["factors"]; weight: keyof Plan["weights"]; label: string; icon: IconName }[] = [
  { key: "taste", weight: "taste", label: "Taste affinity (Qloo)", icon: "music" },
  { key: "footfall", weight: "footfall", label: "Foot traffic for the slot", icon: "footfall" },
  { key: "places", weight: "places", label: "Busy places open nearby", icon: "store" },
  { key: "events", weight: "events", label: "Event crowds", icon: "ticket" },
  { key: "discovery", weight: "discovery", label: "Discovery bonus (hidden gem)", icon: "gem" },
  { key: "weatherPenalty", weight: "weather", label: "Weather penalty", icon: "rain" },
];

const FOOTFALL_NOTE: Record<NonNullable<PlanPitch["footfallSource"]>, string> = {
  sensor: "",
  "nearby-sensors": "Estimated from nearby sensors",
  "qloo-popularity": "Estimated from Qloo area popularity",
};

/**
 * How one pitch's score adds up (the DS ScoreBreakdown): the score in a big cell with "How this score adds up", then each factor as a
 * cell with its icon, label, note and weight ("× 0.35"). The details sheet keeps it at the foot, folded: the board's sheet body is
 * the head, why, foot traffic, facts and setlist (PitchDetails).
 */
export function ScoreBreakdown({ pitch, weights }: { pitch: PlanPitch; weights?: Plan["weights"] }) {
  return (
    <section aria-label="Score breakdown" className="flex flex-col gap-4">
      <div className="flex flex-nowrap items-center gap-4">
        <PercentCell value={pitch.score} size={64} label="Score" />
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
            key === "footfall" && pitch.footfallSource ? FOOTFALL_NOTE[pitch.footfallSource] : "",
            key === "footfall" && pitch.discovery === "usual" ? "Shared with other buskers" : "",
            none ? "None for this pitch" : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <PercentCell value={v === null || none ? null : v * 100} size={40} label={label} />
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
