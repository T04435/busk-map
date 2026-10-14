import "server-only";
import { addDays, localToday, slotHours, type Slot } from "@/lib/slot";
import { CITIES, type CityId } from "@/server/cities";
import { AdapterError, runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchHourlyForecast } from "./client";
import { syntheticWeather } from "./fixtures/synthetic";
import type { WeatherData } from "./schema";

export type { WeatherData, WeatherHour } from "./schema";

/** Open-Meteo forecasts 16 days ahead (today plus 15). */
export const FORECAST_DAYS = 16;

/**
 * Hourly weather for the slot. Fallback: null, and the UI says weather was
 * ignored.
 */
export async function getWeather(
  cityId: CityId,
  slot: Slot,
  context: AdapterContext,
  today: string = localToday(CITIES[cityId].timeZone),
): Promise<AdapterResult<WeatherData>> {
  const city = CITIES[cityId];
  const hours = slotHours(slot);
  return runAdapter<WeatherData>({
    adapter: "weather",
    source: "open-meteo",
    context,
    fallback: null,
    synthetic: () => syntheticWeather(slot.date, hours),
    live: async () => {
      if (slot.date < addDays(today, -1) || slot.date > addDays(today, FORECAST_DAYS - 1)) {
        throw new AdapterError("weather", "not_found", "The slot is outside the forecast range");
      }
      const all = await fetchHourlyForecast(city.center, slot.date, city.timeZone);
      return { date: slot.date, hours: all.filter((h) => hours.includes(h.hour)) };
    },
  });
}
