// SYNTHETIC FIXTURE: invented sensors and counts for tests and offline mode.
// Coordinates are rough CBD points; names and counts are made up, with
// plausible weekly rhythms per area. Not City of Melbourne data.
import type { FootfallData, Sensor, TypicalFootfallData } from "../schema";

type Profile = "retail" | "nightlife" | "market" | "commuter" | "riverside" | "campus" | "quiet";

/** Invented sensors at plausible CBD points, each with an area profile and a peak hourly count. */
const SENSORS: (Sensor & { peak: number; profile: Profile })[] = [
  { id: 9001, name: "Synthetic sensor: Swanston St north", lat: -37.8111, lon: 144.9643, peak: 2600, profile: "retail" },
  { id: 9002, name: "Synthetic sensor: Bourke St Mall", lat: -37.8137, lon: 144.9646, peak: 3400, profile: "retail" },
  { id: 9003, name: "Synthetic sensor: Flinders St", lat: -37.8175, lon: 144.9668, peak: 3000, profile: "commuter" },
  { id: 9004, name: "Synthetic sensor: Southbank promenade", lat: -37.8205, lon: 144.9645, peak: 2100, profile: "riverside" },
  { id: 9005, name: "Synthetic sensor: Docklands", lat: -37.8158, lon: 144.9447, peak: 700, profile: "riverside" },
  { id: 9006, name: "Synthetic sensor: Queen Vic Market", lat: -37.8076, lon: 144.9568, peak: 1500, profile: "market" },
  { id: 9007, name: "Synthetic sensor: Collins St west", lat: -37.8175, lon: 144.9565, peak: 1600, profile: "commuter" },
  { id: 9008, name: "Synthetic sensor: Southern Cross", lat: -37.8183, lon: 144.9529, peak: 2200, profile: "commuter" },
  { id: 9009, name: "Synthetic sensor: Elizabeth St", lat: -37.8146, lon: 144.9627, peak: 1900, profile: "retail" },
  { id: 9010, name: "Synthetic sensor: Lonsdale St (Chinatown)", lat: -37.8117, lon: 144.9677, peak: 1300, profile: "nightlife" },
  { id: 9011, name: "Synthetic sensor: Russell St", lat: -37.8126, lon: 144.9692, peak: 1100, profile: "nightlife" },
  { id: 9012, name: "Synthetic sensor: Flinders Lane east", lat: -37.8162, lon: 144.9701, peak: 900, profile: "nightlife" },
  { id: 9013, name: "Synthetic sensor: Spring St", lat: -37.8118, lon: 144.9736, peak: 650, profile: "quiet" },
  { id: 9014, name: "Synthetic sensor: Birrarung Marr path", lat: -37.8189, lon: 144.9728, peak: 800, profile: "riverside" },
  { id: 9015, name: "Synthetic sensor: Arts Centre forecourt", lat: -37.8217, lon: 144.9689, peak: 1200, profile: "nightlife" },
  { id: 9016, name: "Synthetic sensor: Hardware Lane", lat: -37.8139, lon: 144.9612, peak: 750, profile: "nightlife" },
  { id: 9017, name: "Synthetic sensor: Lincoln Square", lat: -37.8026, lon: 144.9631, peak: 550, profile: "campus" },
  { id: 9018, name: "Synthetic sensor: Lygon St south", lat: -37.8031, lon: 144.9667, peak: 900, profile: "nightlife" },
  { id: 9019, name: "Synthetic sensor: RMIT Bowen St", lat: -37.8083, lon: 144.9643, peak: 1400, profile: "campus" },
  { id: 9020, name: "Synthetic sensor: Flagstaff Gardens", lat: -37.8107, lon: 144.9548, peak: 450, profile: "quiet" },
  { id: 9021, name: "Synthetic sensor: North Melbourne Errol St", lat: -37.8015, lon: 144.9497, peak: 500, profile: "quiet" },
  { id: 9022, name: "Synthetic sensor: Degraves St", lat: -37.8173, lon: 144.9658, peak: 1700, profile: "retail" },
];

export const SYNTHETIC_SENSORS: Sensor[] = SENSORS.map(({ id, name, lat, lon }) => ({ id, name, lat, lon }));

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Day-of-week multipliers (Monday first) and hour-of-day shape per profile: invented but plausible. */
const DAY: Record<Profile, number[]> = {
  retail: [0.8, 0.82, 0.85, 0.95, 1, 1, 0.8],
  nightlife: [0.45, 0.5, 0.65, 0.85, 1, 1, 0.6],
  market: [0.15, 0.85, 0.2, 0.85, 0.9, 1, 0.95],
  commuter: [0.95, 1, 1, 1, 0.95, 0.55, 0.45],
  riverside: [0.6, 0.6, 0.65, 0.7, 0.85, 1, 0.95],
  campus: [0.9, 1, 1, 0.95, 0.8, 0.45, 0.35],
  quiet: [0.7, 0.7, 0.75, 0.8, 0.85, 0.9, 0.8],
};

function hourShape(profile: Profile, hour: number, weekend: boolean): number {
  const bell = (centre: number, width: number) => Math.exp(-(((hour - centre) / width) ** 2));
  switch (profile) {
    case "retail":
      return 0.15 + 0.85 * Math.max(bell(13, 3.5), 0.9 * bell(17.5, 2));
    case "nightlife":
      return 0.1 + 0.9 * Math.max(0.5 * bell(13, 2), bell(weekend ? 21 : 19.5, 2.5));
    case "market":
      return 0.05 + 0.95 * bell(weekend ? 11 : 10, 3);
    case "commuter":
      return weekend ? 0.15 + 0.6 * bell(14, 4) : 0.1 + 0.9 * Math.max(bell(8.5, 1.2), bell(17.3, 1.3), 0.6 * bell(12.5, 1.5));
    case "riverside":
      return 0.1 + 0.9 * Math.max(bell(13, 3), 0.85 * bell(19, 2.5));
    case "campus":
      return 0.1 + 0.9 * bell(weekend ? 14 : 12.5, 3.5);
    case "quiet":
      return 0.15 + 0.85 * bell(13, 4);
  }
}

/** Typical people per hour at a sensor for a weekday and hour. */
export function syntheticCount(sensorId: number, weekday: string, hour: number): number {
  const sensor = SENSORS.find((s) => s.id === sensorId)!;
  const d = Math.max(0, WEEKDAYS.indexOf(weekday));
  return Math.round(sensor.peak * DAY[sensor.profile][d] * hourShape(sensor.profile, hour, d >= 5));
}

const weekdayOfDate = (date: string) => WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];

export function syntheticFootfall(
  baselineDates: string[] = ["2026-10-10", "2026-10-03"],
  slot: { startHour: number; endHour: number } = { startHour: 18, endHour: 21 },
): FootfallData {
  const weekday = weekdayOfDate(baselineDates[0] ?? "2026-10-10");
  const hours = Array.from({ length: Math.max(1, slot.endHour - slot.startHour) }, (_, i) => slot.startHour + i);
  return {
    level: "city-sensors",
    baselineDates,
    liveAsOf: "2026-10-14T14:00:00+00:00",
    sensors: SENSORS.map(({ id, name, lat, lon }) => {
      const avgHourly = Math.round(hours.reduce((sum, h) => sum + syntheticCount(id, weekday, h), 0) / hours.length);
      return { id, name, lat, lon, avgHourly, samples: baselineDates.length * hours.length, liveLastHour: Math.round(avgHourly * 0.4) };
    }),
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

/** Synthetic weekday × hour profiles per sensor (see DAY and hourShape). */
export function syntheticTypical(historyFrom: string, historyTo: string): TypicalFootfallData {
  return {
    level: "city-sensors",
    historyFrom,
    historyTo,
    sensors: SENSORS.map(({ id, name, lat, lon }) => ({
      id,
      name,
      lat,
      lon,
      byWeekdayHour: Object.fromEntries(WEEKDAYS.map((day) => [day, Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, syntheticCount(id, day, h)]))])),
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
