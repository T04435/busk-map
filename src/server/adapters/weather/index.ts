import "server-only";
import { addDays, localToday, slotHours, type Slot } from "@/lib/slot";
import { CITIES, type CityId } from "@/server/cities";
import { AdapterError, runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchHourlyForecast, fetchHourlyForecastRange } from "./client";
import { syntheticWeather } from "./fixtures/synthetic";
import type { WeatherData, WeatherHour } from "./schema";

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

/**
 * Hourly forecast for `days` days from `startDate`, keyed by date (week
 * planner). Days beyond the forecast range are simply absent. Fallback: {}.
 */
export async function getWeatherWeek(
  cityId: CityId,
  startDate: string,
  days: number,
  context: AdapterContext,
  today: string = localToday(CITIES[cityId].timeZone),
): Promise<AdapterResult<Record<string, WeatherHour[]>>> {
  const city = CITIES[cityId];
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
