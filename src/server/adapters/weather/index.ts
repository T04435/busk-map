import "server-only";
import { addDays, slotHours, type Slot } from "@/lib/slot";
import type { City } from "@/server/cities";
import { AdapterError, runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchHourlyForecast, fetchHourlyForecastRange } from "./client";
import { syntheticWeather } from "./fixtures/synthetic";
import type { WeatherData, WeatherHour } from "./schema";
import { serverToday } from "@/server/clock";

export type { WeatherData, WeatherHour } from "./schema";

/** Open-Meteo forecasts 16 days ahead (today plus 15). */
export const FORECAST_DAYS = 16;

/**
 * Hourly weather for the slot. Fallback: null, and the UI says weather was
 * ignored.
 */
export async function getWeather(
  city: City,
  slot: Slot,
  context: AdapterContext,
  today: string = serverToday(city.timeZone),
): Promise<AdapterResult<WeatherData>> {
  const hours = slotHours(slot);
  return runAdapter<WeatherData>({
    adapter: "weather",
    source: "open-meteo",
    context,
    fallback: null,
    synthetic: () => ({ ...syntheticWeather(slot.date, hours), around: syntheticWeather(slot.date, [slot.startHour - 2, slot.startHour - 1, slot.endHour, slot.endHour + 1].filter((h) => h >= 0 && h < 24)).hours }),
    live: async () => {
      if (slot.date < addDays(today, -1) || slot.date > addDays(today, FORECAST_DAYS - 1)) {
        throw new AdapterError("weather", "not_found", "The slot is outside the forecast range");
      }
      const all = await fetchHourlyForecast(city.center, slot.date, city.timeZone);
      const near = (h: WeatherHour) => !hours.includes(h.hour) && h.hour >= Math.max(0, slot.startHour - 2) && h.hour < Math.min(24, slot.endHour + 2);
      return { date: slot.date, hours: all.filter((h) => hours.includes(h.hour)), around: all.filter(near) };
    },
  });
}

/**
 * Hourly forecast for `days` days from `startDate`, keyed by date (week
 * planner). Days beyond the forecast range are simply absent. Fallback: {}.
 */
export async function getWeatherWeek(
  city: City,
  startDate: string,
  days: number,
  context: AdapterContext,
  today: string = serverToday(city.timeZone),
): Promise<AdapterResult<Record<string, WeatherHour[]>>> {
  const last = addDays(today, FORECAST_DAYS - 1);
  const wantedEnd = addDays(startDate, days - 1);
  const endDate = wantedEnd < last ? wantedEnd : last;
  return runAdapter<Record<string, WeatherHour[]>>({
    adapter: "weather",
    source: "open-meteo",
    context,
    fallback: {},
    synthetic: () =>
      Object.fromEntries(
        Array.from({ length: days }, (_, i) => addDays(startDate, i)).map((date) => [date, syntheticWeather(date, Array.from({ length: 24 }, (_, h) => h)).hours]),
      ),
    live: async () => {
      if (startDate > endDate) throw new AdapterError("weather", "not_found", "The week is outside the forecast range");
      return fetchHourlyForecastRange(city.center, startDate, endDate, city.timeZone);
    },
  });
}
