import "server-only";
import { addDays, baselineDates, localToday, type Slot } from "@/lib/slot";
import { CITIES, type CityId } from "@/server/cities";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchLiveCounts, fetchSensors, fetchSlotAverages, fetchTypicalByWeekdayHour } from "./client";
import { syntheticFootfall, syntheticTypical } from "./fixtures/synthetic";
import type { FootfallData, TypicalFootfallData } from "./schema";

export type { FootfallData, SensorFootfall, TypicalFootfallData } from "./schema";

/** Weeks of history behind the hour-of-week baseline. */
export const BASELINE_WEEKS = 8;

export const FOOTFALL_FALLBACK: FootfallData = {
  level: "unavailable",
  sensors: [],
  baselineDates: [],
  liveAsOf: null,
};

/**
 * Foot traffic for a slot: Level 1 (city sensors) in Melbourne. When the
 * sensors are unavailable, the level drops to "unavailable" and the scoring
 * engine leans on Qloo place popularity instead (labelled in the UI).
 */
export async function getFootfall(
  cityId: CityId,
  slot: Slot,
  context: AdapterContext,
  today: string = localToday(CITIES[cityId].timeZone),
): Promise<AdapterResult<FootfallData>> {
  const dates = baselineDates(slot.date, today, BASELINE_WEEKS);
  return runAdapter({
    adapter: "footfall",
    source: "melbourne-pedestrian",
    context,
    configured: CITIES[cityId].footfallLevel === "city-sensors",
    fallback: FOOTFALL_FALLBACK,
    synthetic: () => syntheticFootfall(dates),
    live: async () => {
      const [sensors, averages, live] = await Promise.all([
        fetchSensors(),
        fetchSlotAverages(dates, slot.startHour, slot.endHour),
        // The live feed is a bonus: its failure must not sink the baseline.
        fetchLiveCounts().catch(() => ({ asOf: null, counts: {} as Record<number, number> })),
      ]);
      return {
        level: "city-sensors",
        baselineDates: dates,
        liveAsOf: live.asOf,
        sensors: sensors.map((sensor) => ({
          ...sensor,
          avgHourly: averages[sensor.id]?.avgHourly ?? null,
          samples: averages[sensor.id]?.samples ?? 0,
          liveLastHour: live.counts[sensor.id] ?? null,
        })),
      };
    },
  });
}

export const TYPICAL_FALLBACK: TypicalFootfallData = { level: "unavailable", sensors: [], historyFrom: null, historyTo: null };

/**
 * Typical foot traffic by weekday and hour (the last BASELINE_WEEKS weeks),
 * for the week planner. Hours outside [startHour, endHour) are not fetched.
 */
export async function getTypicalFootfall(
  cityId: CityId,
  startHour: number,
  endHour: number,
  context: AdapterContext,
  today: string = localToday(CITIES[cityId].timeZone),
): Promise<AdapterResult<TypicalFootfallData>> {
  const from = addDays(today, -7 * BASELINE_WEEKS);
  return runAdapter({
    adapter: "footfall",
    source: "melbourne-pedestrian",
    context,
    configured: CITIES[cityId].footfallLevel === "city-sensors",
    fallback: TYPICAL_FALLBACK,
    synthetic: () => syntheticTypical(from, addDays(today, -1)),
    live: async () => {
      const [sensors, typical] = await Promise.all([fetchSensors(), fetchTypicalByWeekdayHour(from, today, startHour, endHour)]);
      return {
        level: "city-sensors",
        historyFrom: from,
        historyTo: addDays(today, -1),
        sensors: sensors.map((sensor) => ({ ...sensor, byWeekdayHour: typical[sensor.id] ?? {} })),
      };
    },
  });
}
