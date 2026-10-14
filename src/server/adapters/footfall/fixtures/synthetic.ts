// SYNTHETIC FIXTURE: invented sensors and counts for tests and offline mode.
// Coordinates are rough CBD points; names are made up. Not City of Melbourne data.
import type { FootfallData, Sensor, TypicalFootfallData } from "../schema";

export const SYNTHETIC_SENSORS: Sensor[] = [
  { id: 9001, name: "Synthetic sensor: Swanston St north", lat: -37.8111, lon: 144.9643 },
  { id: 9002, name: "Synthetic sensor: Bourke St Mall", lat: -37.8137, lon: 144.9646 },
  { id: 9003, name: "Synthetic sensor: Flinders St", lat: -37.8175, lon: 144.9668 },
  { id: 9004, name: "Synthetic sensor: Southbank promenade", lat: -37.8205, lon: 144.9645 },
  { id: 9005, name: "Synthetic sensor: Docklands", lat: -37.8158, lon: 144.9447 },
  { id: 9006, name: "Synthetic sensor: Queen Vic Market", lat: -37.8076, lon: 144.9568 },
];

const COUNTS: Record<number, number> = { 9001: 2400, 9002: 3100, 9003: 2800, 9004: 1900, 9005: 650, 9006: 900 };

export function syntheticFootfall(baselineDates: string[] = ["2026-10-10", "2026-10-03"]): FootfallData {
  return {
    level: "city-sensors",
    baselineDates,
    liveAsOf: "2026-10-14T14:00:00+00:00",
    sensors: SYNTHETIC_SENSORS.map((sensor) => ({
      ...sensor,
      avgHourly: COUNTS[sensor.id],
      samples: baselineDates.length * 3,
      liveLastHour: Math.round(COUNTS[sensor.id] * 0.4),
    })),
  };
}

/** Raw API-shaped payloads, for client tests. */
export const SYNTHETIC_RAW = {
  sensors: {
    total_count: 3,
    results: [
      { location_id: 9001, sensor_description: "Synthetic sensor A", sensor_name: "SynA_T", status: "A", latitude: -37.8111, longitude: 144.9643 },
      { location_id: 9002, sensor_description: "Synthetic sensor B", sensor_name: "SynB_T", status: "A", latitude: -37.8137, longitude: 144.9646 },
      { location_id: 9003, sensor_description: null, sensor_name: null, status: "I", latitude: -37.8175, longitude: 144.9668 },
    ],
  },
  averages: {
    total_count: 2,
    results: [
      { location_id: 9001, avg_count: 1200.5, n: 24 },
      { location_id: 9002, avg_count: null, n: 0 },
    ],
  },
  latest: { total_count: 1, results: [{ latest: "2026-10-14T14:04:00+00:00" }] },
  live: {
    total_count: 2,
    results: [
      { location_id: 9001, count: 410 },
      { location_id: 9003, count: 50 },
    ],
  },
};

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Synthetic weekday × hour profile: busier evenings and weekends. */
export function syntheticTypical(historyFrom: string, historyTo: string): TypicalFootfallData {
  return {
    level: "city-sensors",
    historyFrom,
    historyTo,
    sensors: SYNTHETIC_SENSORS.map((sensor) => ({
      ...sensor,
      byWeekdayHour: Object.fromEntries(
        WEEKDAYS.map((day, d) => [
          day,
          Object.fromEntries(
            Array.from({ length: 24 }, (_, h) => [h, Math.round(COUNTS[sensor.id] * (d >= 4 ? 1.2 : 0.9) * (h >= 11 && h <= 20 ? 1 : 0.4))]),
          ),
        ]),
      ),
    })),
  };
}

export const SYNTHETIC_RAW_TYPICAL = [
  { location_id: 9001, hourday: 18, "date_format(sensing_date,'E')": "Sat", dow: null, avg_count: 1500 },
  { location_id: 9001, hourday: 19, "date_format(sensing_date,'E')": "Sat", dow: null, avg_count: 1300.5 },
  { location_id: 9002, hourday: 10, "date_format(sensing_date,'E')": "Mon", dow: null, avg_count: 400 },
  { location_id: 9002, hourday: 11, "date_format(sensing_date,'E')": "Xyz", dow: null, avg_count: 1 },
  { location_id: 9002, hourday: 12, "date_format(sensing_date,'E')": "Mon", dow: null, avg_count: null },
];
