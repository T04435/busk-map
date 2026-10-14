import { z } from "zod";

/** City of Melbourne Opendatasoft Explore API v2.1 responses (fields we use). */

export const sensorLocationsSchema = z.object({
  results: z.array(
    z.object({
      location_id: z.number().int(),
      sensor_description: z.string().nullable(),
      sensor_name: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      latitude: z.number(),
      longitude: z.number(),
    }),
  ),
});

export const slotAveragesSchema = z.object({
  results: z.array(
    z.object({
      location_id: z.number().int(),
      avg_count: z.number().nullable(),
      n: z.number().int(),
    }),
  ),
});

export const latestSchema = z.object({
  results: z.array(z.object({ latest: z.string().nullable() })),
});

export const liveCountsSchema = z.object({
  results: z.array(
    z.object({
      location_id: z.number().int(),
      count: z.number().nullable(),
    }),
  ),
});

export type Sensor = { id: number; name: string; lat: number; lon: number };

export type SensorFootfall = Sensor & {
  /** Average pedestrians per hour across the slot's hours on recent same weekdays. */
  avgHourly: number | null;
  /** Hour samples behind the average. */
  samples: number;
  /** Pedestrians in the latest 60 minutes of the live feed. */
  liveLastHour: number | null;
};

export type FootfallData = {
  level: "city-sensors" | "unavailable";
  sensors: SensorFootfall[];
  /** Dates used for the baseline (same weekday, most recent first). */
  baselineDates: string[];
  /** Timestamp of the newest live reading (ISO), when the live feed responded. */
  liveAsOf: string | null;
};
