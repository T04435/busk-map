import { z } from "zod";

/** Open-Meteo /v1/forecast hourly response (fields we request). */
const series = z.array(z.number().nullable());

export const forecastSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: series,
    precipitation_probability: series,
    precipitation: series,
    wind_speed_10m: series,
    weather_code: series,
  }),
});

export type WeatherHour = {
  /** Local hour, 0–23. */
  hour: number;
  temperatureC: number | null;
  precipitationProbability: number | null;
  precipitationMm: number | null;
  windKmh: number | null;
  weatherCode: number | null;
};

/** `hours` are the slot's hours (they feed the score); `around` are the hours just before and after, shown by the weather strip only. */
export type WeatherData = { date: string; hours: WeatherHour[]; around?: WeatherHour[] } | null;
