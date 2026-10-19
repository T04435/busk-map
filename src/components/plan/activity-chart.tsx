import { EstimateLabel } from "@/components/plan/estimate-label";
import { activitySentence, activitySourceNote, activityWord, wordLevel, type ActivityBasis } from "@/lib/activity";
import { formatHour } from "@/lib/slot";

const W = 300;
const H = 64;
const PAD = 14;

/**
 * "Estimated activity by hour" (board B57): the slot's weekday across 24 hours as a dashed line over a soft area, the slot shaded,
 * the axis at 00 06 12 18 23. The level is Qloo's relative estimate (popular places open in each hour, and where activity
 * concentrates), shown as a word and never as a head count; the chart is on a fixed 0 to 1 scale so a quiet pitch looks quiet.
 * With no estimate (Qloo had no heatmap or places there) there is no chart and the line says so.
 */
export function ActivityChart({
  activity,
  basis,
  weekday,
  slot,
}: {
  activity: { level: number; relative: number | null; hourly: number[] | null } | null;
  basis: ActivityBasis;
  weekday: string;
  slot: { startHour: number; endHour: number };
}) {
  const hourly = activity?.hourly ?? null;
  const values = hourly ?? [];
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = (v: number) => H - PAD - v * (H - PAD - 4);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const area = `${line}L${W} ${H - PAD}L0 ${H - PAD}Z`;
  let peak = 0;
  values.forEach((v, h) => {
    if (v > values[peak]) peak = h;
  });
  const flat = n > 0 && Math.max(...values) - Math.min(...values) < 0.01;
  const slotX0 = x(slot.startHour);
  const slotX1 = x(Math.min(23, slot.endHour));
  const sentence = activity ? activitySentence({ level: wordLevel(activity.level, activity.relative), basis, weekday, startHour: slot.startHour }) : null;
  return (
    <section aria-label="Estimated activity by hour" className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="m-0 font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">Estimated activity by hour</h4>
        {activity ? (
          <p className="m-0 flex items-baseline gap-1 text-sm leading-5" data-testid="sheet-activity">
            <b className="font-display text-[22px] leading-none">{activityWord(wordLevel(activity.level, activity.relative))}</b>
            <EstimateLabel tag="est." basis={`${activitySourceNote(basis)}${activity.relative !== null ? ". The word compares this pitch with the other pitches scored for this plan" : ""}`} />
            <span className="text-muted-foreground">in your slot</span>
          </p>
        ) : null}
      </div>
      {hourly && activity ? (
        <figure className="m-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Estimated activity by hour: ${flat ? "about the same all day" : `busiest around ${formatHour(peak)}`}; your slot is ${formatHour(slot.startHour)} to ${formatHour(slot.endHour)}. An estimate.`}
            className="block h-auto w-full overflow-visible"
          >
            <rect x={slotX0} y={0} width={Math.max(2, slotX1 - slotX0)} height={H - PAD} rx={4} className="fill-accent" />
            <path d={area} className="fill-[color-mix(in_oklab,var(--footfall)_14%,transparent)]" />
            <path d={line} className="fill-none stroke-footfall stroke-[2.5] [stroke-dasharray:4_4] [stroke-linecap:round] [stroke-linejoin:round]" />
            {[0, 6, 12, 18, 23].map((h) => (
              <text key={h} x={Math.min(W - 14, Math.max(0, x(h) - 6))} y={H - 1} className="fill-muted-foreground" style={{ font: "500 11px var(--font-mono)" }}>
                {String(h).padStart(2, "0")}
              </text>
            ))}
          </svg>
          <figcaption className="mt-1 text-[13px] leading-[18px] text-muted-foreground" data-testid="sheet-activity-note">
            {sentence}
            {flat ? ". The estimate is flat through the day: no nearby place opens or closes in a way that changes it" : ""}
          </figcaption>
        </figure>
      ) : (
        <p className="m-0 text-[13px] leading-[18px] text-muted-foreground" data-testid="sheet-activity-note">
          {sentence ?? "No activity estimate for this pitch: Qloo had no heatmap or places data there."}
        </p>
      )}
    </section>
  );
}
