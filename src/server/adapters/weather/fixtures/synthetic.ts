// SYNTHETIC FIXTURE: invented forecast for tests and offline mode. Not Open-Meteo data.
import type { WeatherHour } from "../schema";

export function syntheticWeather(date: string, hours: number[]): { date: string; hours: WeatherHour[] } {
  return {
    date,
    hours: hours.map((hour) => ({
      hour,
      temperatureC: 19,
      precipitationProbability: 10,
      precipitationMm: 0,
      windKmh: 12,
      weatherCode: 2,
    })),
  };
}

export const SYNTHETIC_RAW = {
  hourly: {
    time: Array.from({ length: 24 }, (_, h) => `2026-10-17T${String(h).padStart(2, "0")}:00`),
    temperature_2m: Array.from({ length: 24 }, (_, h) => 10 + h / 2),
    precipitation_probability: Array.from({ length: 24 }, (_, h) => (h >= 18 ? 70 : 0)),
    precipitation: Array.from({ length: 24 }, (_, h) => (h >= 18 ? 1.2 : 0)),
    wind_speed_10m: Array.from({ length: 24 }, () => 15),
    weather_code: Array.from({ length: 24 }, (_, h) => (h === 20 ? null : 61)),
  },
};
