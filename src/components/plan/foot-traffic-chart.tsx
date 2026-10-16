import { EstimateLabel } from "@/components/plan/estimate-label";
import { formatHour } from "@/lib/slot";

const W = 360;
const H = 84;
const PAD_TOP = 6;

/**
 * "Foot traffic by hour" (board B57): the slot's weekday across 24 hours as a dashed line over a soft area, the slot shaded, the
 * axis at 00 06 12 18 23. The figure is the slot's average people an hour, marked as an estimate. When the sensors didn't answer
 * there is no chart and the line says what the number was estimated from instead (D03).
 */
export function FootTrafficChart({
  hourly,
  avgHourly,
  sensorName,
  slot,
  unavailable,
}: {
  hourly: (number | null)[] | null;
  avgHourly: number | null;
  sensorName: string | null;
  slot: { startHour: number; endHour: number };
  /** The sensors did not answer: the number was estimated from busy places and events. */
  unavailable: boolean;
}) {
  const values = hourly ?? [];
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const x = (h: number) => (h / 23) * W;
  const y = (v: number | null) => PAD_TOP + (1 - (v ?? 0) / max) * (H - PAD_TOP - 2);
  const line = values.map((v, h) => `${h === 0 ? "M" : "L"}${x(h).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  let peak = 0;
  values.forEach((v, h) => {
    if ((v ?? -1) > (values[peak] ?? -1)) peak = h;
  });
  const slotX0 = x(slot.startHour);
  const slotX1 = x(Math.min(23, slot.endHour));
  return (
    <section aria-label="Foot traffic by hour" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Foot traffic by hour</h4>
        {avgHourly !== null ? (
          <p className="m-0 flex items-baseline gap-1 text-sm" data-testid="sheet-footfall">
            <b className="font-display text-[22px] leading-none">{avgHourly.toLocaleString("en-AU")}</b>
            <span className="font-mono text-xs">/h</span>
            <EstimateLabel tag="est." />
            <span className="text-muted-foreground">in your slot</span>
          </p>
        ) : null}
      </div>
      {hourly && !unavailable ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H + 16}`}
            role="img"
            aria-label={`Foot traffic by hour${sensorName ? ` at ${sensorName}` : ""}: busiest around ${formatHour(peak)}; your slot is ${formatHour(slot.startHour)} to ${formatHour(slot.endHour)}. An estimate.`}
            className="block h-auto w-full"
          >
            <rect x={slotX0} y={0} width={Math.max(2, slotX1 - slotX0)} height={H} className="fill-primary/25" />
            <path d={area} className="fill-muted" />
            <path d={line} fill="none" strokeWidth={2.5} strokeDasharray="5 3" className="stroke-foreground" vectorEffect="non-scaling-stroke" />
            {[0, 6, 12, 18, 23].map((h) => (
              <text key={h} x={x(h)} y={H + 13} textAnchor={h === 0 ? "start" : h === 23 ? "end" : "middle"} className="fill-muted-foreground font-mono" style={{ font: "500 11px var(--font-mono)" }}>
                {String(h).padStart(2, "0")}
              </text>
            ))}
          </svg>
          {sensorName ? <p className="m-0 text-sm text-muted-foreground">Estimated from the {sensorName} sensor: typical people an hour on recent same weekdays</p> : null}
        </>
      ) : (
        <p className="m-0 text-sm text-muted-foreground" data-testid="sheet-footfall-note">
          {unavailable
            ? "Estimated from busy places and events: the sensors did not answer"
            : sensorName
              ? `Estimated from the ${sensorName} sensor`
              : "No sensor count for this pitch."}
        </p>
      )}
    </section>
  );
}
