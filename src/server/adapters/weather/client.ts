import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { round, type LatLon } from "@/lib/geo";
import { fetchJson } from "../core";
import { forecastSchema, type WeatherHour } from "./schema";

/** Open-Meteo hourly forecast (CC BY 4.0, no key). Cache policy: 1 hour. */
const BASE = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 5_000;

export async function fetchHourlyForecast(point: LatLon, date: string, timeZone: string): Promise<WeatherHour[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("weather");

  const params = new URLSearchParams({
    latitude: String(round(point.lat, 3)),
    longitude: String(round(point.lon, 3)),
    hourly: "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code",
    timezone: timeZone,
    start_date: date,
    end_date: date,
  });
  const body = await fetchJson(`${BASE}?${params}`, { adapter: "weather", schema: forecastSchema, timeoutMs: TIMEOUT_MS });
  const h = body.hourly;
  return h.time.map((time, i) => ({
    hour: Number(time.slice(11, 13)),
    temperatureC: h.temperature_2m[i] ?? null,
    precipitationProbability: h.precipitation_probability[i] ?? null,
    precipitationMm: h.precipitation[i] ?? null,
    windKmh: h.wind_speed_10m[i] ?? null,
    weatherCode: h.weather_code[i] ?? null,
  }));
}
