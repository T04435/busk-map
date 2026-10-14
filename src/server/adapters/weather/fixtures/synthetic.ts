// SYNTHETIC FIXTURE: invented forecast for tests and offline mode. Not Open-Meteo data.
import type { WeatherHour } from "../schema";

/** A deterministic, varied week: one wet afternoon, one windy cool day, the rest mild. */
function dayWeather(date: string) {
  const day = Number(date.slice(8, 10));
  switch (day % 7) {
    case 0:
      return { temp: 15, rainFrom: 13, rain: 75, wind: 22 }; // wet afternoon and evening
    case 3:
      return { temp: 12, rainFrom: 24, rain: 0, wind: 38 }; // cool, gusty
    case 5:
      return { temp: 17, rainFrom: 9, rain: 35, wind: 15 }; // showers about
    default:
      return { temp: 19 + (day % 3), rainFrom: 24, rain: 0, wind: 12 };
  }
}

export function syntheticWeather(date: string, hours: number[]): { date: string; hours: WeatherHour[] } {
  const w = dayWeather(date);
  return {
    date,
    hours: hours.map((hour) => ({
      hour,
      temperatureC: Math.round((w.temp - 4 + 6 * Math.sin(((hour - 8) / 24) * Math.PI * 2 - 0.3)) * 10) / 10,
      precipitationProbability: hour >= w.rainFrom ? w.rain : 10,
      precipitationMm: hour >= w.rainFrom && w.rain > 50 ? 1.4 : 0,
      windKmh: w.wind,
      weatherCode: hour >= w.rainFrom && w.rain > 50 ? 61 : 2,
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
