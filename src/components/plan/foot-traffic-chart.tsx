import { EstimateLabel } from "@/components/plan/estimate-label";
import { formatHour } from "@/lib/slot";

const W = 300;
const H = 64;
const PAD = 14;

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
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = (v: number | null) => H - PAD - ((v ?? 0) / max) * (H - PAD - 4);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const area = `${line}L${W} ${H - PAD}L0 ${H - PAD}Z`;
  let peak = 0;
  values.forEach((v, h) => {
    if ((v ?? -1) > (values[peak] ?? -1)) peak = h;
  });
  const slotX0 = x(slot.startHour);
  const slotX1 = x(Math.min(23, slot.endHour));
  const caption = sensorName ? `Estimated from the ${sensorName} sensor: typical people an hour on recent same weekdays` : null;
  return (
    <section aria-label="Foot traffic by hour" className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="m-0 font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">Foot traffic by hour</h4>
        {avgHourly !== null ? (
          <p className="m-0 flex items-baseline gap-1 text-sm leading-5" data-testid="sheet-footfall">
            <b className="font-display text-[22px] leading-none">{avgHourly.toLocaleString("en-AU")}</b>
            <span className="font-mono text-xs">/h</span>
            <EstimateLabel tag="est." basis={caption ?? undefined} />
            <span className="text-muted-foreground">in your slot</span>
          </p>
        ) : null}
      </div>
      {hourly && !unavailable ? (
        <figure className="m-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Foot traffic by hour${sensorName ? ` at ${sensorName}` : ""}: busiest around ${formatHour(peak)}; your slot is ${formatHour(slot.startHour)} to ${formatHour(slot.endHour)}. An estimate.`}
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
          {caption ? <figcaption className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{caption}</figcaption> : null}
        </figure>
      ) : (
        <p className="m-0 text-[13px] leading-[18px] text-muted-foreground" data-testid="sheet-footfall-note">
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
