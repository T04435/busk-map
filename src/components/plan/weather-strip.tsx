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
          <p className="m-0 font-bold">No forecast for this slot, so weather was ignored.</p>
          <p className="m-0 text-sm text-muted-foreground">Weather is left out of the score.</p>
        </div>
      </div>
    );
  const inSlot = (hour: number) => hour >= slot.startHour && hour < slot.endHour;
  const wet = weather.hours.filter((h) => inSlot(h.hour) && (h.precipitationProbability ?? 0) >= 50).length;
  return (
    <section aria-label="Weather" className="border-2 border-rule bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">{wet ? "Rain in your slot" : "Dry through your slot"}</h2>
        <span className="font-mono text-xs text-muted-foreground">°C · rain · wind km/h</span>
      </div>
      <ul aria-label="Forecast for the slot" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {weather.hours.map((h) => {
          const rain = h.precipitationProbability;
          const Icon = (rain ?? 0) >= 50 ? CloudRain : (rain ?? 0) >= 20 ? Cloud : Sun;
          return (
            <li
              key={h.hour}
              className={cn("flex min-w-[104px] flex-1 flex-col gap-1 border px-3 py-2", inSlot(h.hour) ? "border-rule bg-secondary" : "border-border")}
              aria-label={`${formatHour(h.hour)}${inSlot(h.hour) ? ", in your slot" : ""}, ${h.temperatureC ?? "unknown"} degrees, ${rain ?? "unknown"}% rain${(rain ?? 0) >= 50 ? " (likely)" : ""}, wind ${h.windKmh ?? "unknown"} km/h`}
            >
              <span className="font-mono text-xs font-bold">{formatHour(h.hour)}{inSlot(h.hour) ? <span className="ml-1 bg-primary px-1 text-primary-foreground">Your slot</span> : null}</span>
              <span aria-hidden="true" className="flex items-center gap-2">
                <Icon className="size-4" />
                <b className="font-display text-[26px] leading-none">{h.temperatureC ?? "?"}°</b>
                <span className={cn("font-mono text-sm", (rain ?? 0) >= 50 && "font-extrabold")}>{rain ?? "?"}%</span>
                <span className="font-mono text-sm text-muted-foreground">{h.windKmh ?? "?"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
