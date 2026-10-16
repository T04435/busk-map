import { Cloud, CloudRain, Sun } from "lucide-react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { formatHour } from "@/lib/slot";
import type { Plan } from "@/lib/plan-schema";

/**
 * One line per hour: time in mono, an icon, the temperature in condensed numerals, the chance of rain and the wind. The slot is
 * framed once with an orange "Your slot" tag; one unit key; 50%+ rain is bold and says so in words (never colour alone).
 * No forecast: the dashed unavailable box.
 */
export function WeatherStrip({ weather, slot }: { weather: Plan["weather"]; slot: { startHour: number; endHour: number } }) {
  if (!weather)
    return (
      <div role="status" data-testid="weather-unavailable" className="flex items-center gap-3 border-2 border-dashed border-input p-4">
        <HexCell size={36} tone="dashed">
          <Cloud aria-hidden="true" className="size-[18px]" />
        </HexCell>
        <div>
          <p className="m-0 font-bold">No forecast for this slot</p>
          <p className="m-0 text-sm text-muted-foreground">Weather is left out of the score.</p>
        </div>
      </div>
    );
  const inSlot = (hour: number) => hour >= slot.startHour && hour < slot.endHour;
  const wet = weather.hours.filter((h) => inSlot(h.hour) && (h.precipitationProbability ?? 0) >= 50).length;
  // The hours either side of the slot (muted), then the slot's own, framed once with its tag.
  const hours = [...(weather.around ?? []), ...weather.hours].sort((x, y) => x.hour - y.hour);
  const firstSlot = hours.find((h) => inSlot(h.hour))?.hour;
  const lastSlot = hours.findLast((h) => inSlot(h.hour))?.hour;
  return (
    <section aria-label="Weather" className="border-2 border-rule bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Weather</span>
          <h2 className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">{wet ? "Rain in your slot" : "Dry through your slot"}</h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">°C · rain · wind km/h</span>
      </div>
      <ul aria-label="Forecast around the slot" className="m-0 flex list-none flex-col p-0 pt-3 sm:flex-row">
        {hours.map((h) => {
          const rain = h.precipitationProbability;
          const Icon = (rain ?? 0) >= 50 ? CloudRain : (rain ?? 0) >= 20 ? Cloud : Sun;
          const mine = inSlot(h.hour);
          const first = h.hour === firstSlot;
          const last = h.hour === lastSlot;
          return (
            <li
              key={h.hour}
              data-in-slot={mine ? "" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:flex-col sm:items-start sm:gap-1",
                mine && "border-rule bg-secondary max-sm:border-x-2 sm:border-y-2",
                first && "max-sm:border-t-2 sm:border-l-2",
                last && "max-sm:border-b-2 sm:border-r-2",
                !mine && "text-muted-foreground",
              )}
              aria-label={`${formatHour(h.hour)}${mine ? ", in your slot" : ""}, ${h.temperatureC ?? "unknown"} degrees, ${rain ?? "unknown"}% rain${(rain ?? 0) >= 50 ? " (likely)" : ""}, wind ${h.windKmh ?? "unknown"} km/h`}
            >
              {first ? (
                <span aria-hidden="true" className="absolute -top-3 left-2 border border-(--fill-rule) bg-primary px-1.5 font-mono text-[11px] leading-5 font-bold tracking-[0.04em] whitespace-nowrap text-primary-foreground uppercase">
                  Your slot {slot.startHour}–{slot.endHour}
                </span>
              ) : null}
              <span aria-hidden="true" className="w-12 font-mono text-xs font-bold text-foreground sm:w-auto">{String(h.hour).padStart(2, "0")}:00</span>
              <span aria-hidden="true" className="flex flex-wrap items-center gap-x-2">
                <Icon className="size-4" />
                <b className="font-display text-[26px] leading-none text-foreground">{h.temperatureC != null ? Math.round(h.temperatureC) : "?"}°</b>
                <span className={cn("font-mono text-sm", (rain ?? 0) >= 50 && "font-extrabold text-foreground")}>{rain ?? "?"}%</span>
                <span className="font-mono text-sm">{h.windKmh != null ? Math.round(h.windKmh) : "?"}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-3 font-mono text-xs text-muted-foreground">Open-Meteo forecast (CC BY 4.0)</p>
    </section>
  );
}
