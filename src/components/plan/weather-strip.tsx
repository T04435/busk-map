import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Badge } from "@/components/ui/badge";
import { formatHour } from "@/lib/slot";
import type { Plan } from "@/lib/plan-schema";

/**
 * One line per hour: time in mono, an icon, the temperature in condensed numerals, the chance of rain and the wind. The slot is
 * framed once with an orange "Your slot" tag; one unit key; 50%+ rain is bold and says so in words (never colour alone).
 * No forecast: the dashed unavailable box.
 */
export function WeatherStrip({
  weather,
  slot,
  titleAs: Title = "h2",
}: {
  weather: Plan["weather"];
  slot: { startHour: number; endHour: number };
  /** The title element: an h2 in the plan's outline; a `p` where the strip is a specimen (the /brand page, B-210). */
  titleAs?: "h2" | "h3" | "p";
}) {
  if (!weather)
    return (
      <div role="status" data-testid="weather-unavailable" className="flex items-center gap-3 border-[1.5px] border-dashed border-input px-4 py-3">
        <HexCell size={36} tone="dashed">
          <Icon name="cloud" size={18} />
        </HexCell>
        <div>
          <div className="font-mono text-xs leading-4 font-bold tracking-[0.06em] uppercase">No forecast for this slot</div>
          <div className="text-sm leading-5 text-muted-foreground">Weather is left out of the score.</div>
        </div>
      </div>
    );
  const inSlot = (hour: number) => hour >= slot.startHour && hour < slot.endHour;
  const wet = weather.hours.filter((h) => inSlot(h.hour) && (h.precipitationProbability ?? 0) >= 50).length;
  // The hours either side of the slot (muted), then the slot's own, framed once with its tag.
  const hours = [...(weather.around ?? []), ...weather.hours].sort((x, y) => x.hour - y.hour);
  const before = hours.filter((h) => h.hour < slot.startHour);
  const within = hours.filter((h) => inSlot(h.hour));
  const after = hours.filter((h) => h.hour >= slot.endHour);
  const column = (h: (typeof hours)[number], mine: boolean, divider = false) => {
    const rain = h.precipitationProbability;
    const isWet = (rain ?? 0) >= 50;
    return (
      <div
        key={h.hour}
        role="listitem"
        data-in-slot={mine ? "" : undefined}
        className={"grid flex-[1_0_108px] content-start justify-items-start gap-0 px-1.5 py-1 text-left" + (divider ? " border-l border-border" : "")}
        aria-label={`${formatHour(h.hour)}${mine ? ", in your slot" : ""}, ${h.temperatureC ?? "unknown"} degrees, ${rain ?? "unknown"}% rain${isWet ? " (likely)" : ""}, wind ${h.windKmh ?? "unknown"} km/h`}
      >
        <span aria-hidden="true" className="font-mono text-[11px] text-muted-foreground">{String(h.hour).padStart(2, "0")}:00</span>
        <span aria-hidden="true" className="inline-flex items-baseline gap-[5px] whitespace-nowrap">
          <Icon name={isWet ? "rain" : (rain ?? 0) >= 20 ? "cloud" : "sun"} size={16} className="self-center text-weather" />
          <b className="font-display text-[17px] leading-5 font-extrabold tabular-nums">{h.temperatureC != null ? Math.round(h.temperatureC) : "?"}°</b>
          <span className={isWet ? "font-mono text-[11px] font-bold text-foreground" : "font-mono text-[11px] text-muted-foreground"}>{rain ?? "?"}%</span>
          <span className="font-mono text-[11px] text-muted-foreground">{h.windKmh != null ? Math.round(h.windKmh) : "?"}</span>
        </span>
      </div>
    );
  };
  return (
    <section aria-label="Weather" className="grid min-w-0 gap-1 border-2 border-rule bg-card px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">Weather</span>
        <Title className="m-0 font-display text-lg leading-5 font-extrabold tracking-[0.01em] uppercase">{wet ? "Rain in your slot" : "Dry through your slot"}</Title>
        <span className="ml-auto font-mono text-[10px] leading-[14px] tracking-[0.04em] text-muted-foreground">°C · rain · wind km/h</span>
      </div>
      <div role="list" aria-label="Forecast around the slot" tabIndex={0} className="flex items-stretch overflow-x-auto pt-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {before.map((h) => column(h, false))}
        {within.length ? (
          <div role="none" className="relative flex flex-[3_0_auto] border-2 border-rule">
            <Badge aria-hidden="true" variant="tag-slot" className="absolute -top-[13px] left-2">
              Your slot {slot.startHour}–{slot.endHour}
            </Badge>
            {within.map((h, i) => column(h, true, i > 0))}
          </div>
        ) : null}
        {after.map((h) => column(h, false))}
      </div>
      <p className="m-0 text-[13px] leading-[18px] text-muted-foreground">Open-Meteo forecast (CC BY 4.0)</p>
    </section>
  );
}
