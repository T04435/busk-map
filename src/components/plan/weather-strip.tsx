import { formatHour } from "@/lib/slot";
import type { Plan } from "@/lib/plan-schema";

export function WeatherStrip({ weather }: { weather: Plan["weather"] }) {
  if (!weather) return <p className="text-sm text-muted-foreground">No forecast for this slot, so weather was ignored.</p>;
  return (
    <ul className="flex flex-wrap gap-4 text-sm" aria-label="Forecast for the slot">
      {weather.hours.map((h) => (
        <li key={h.hour}>
          <span className="font-medium">{formatHour(h.hour)}</span>{" "}
          <span className="text-muted-foreground">
            {h.temperatureC ?? "?"}°C, rain {h.precipitationProbability ?? "?"}%, wind {h.windKmh ?? "?"} km/h
          </span>
        </li>
      ))}
    </ul>
  );
}
