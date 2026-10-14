import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { fetchJson } from "../core";
import {
  typicalRowsSchema,
  latestSchema,
  liveCountsSchema,
  sensorLocationsSchema,
  slotAveragesSchema,
  type Sensor,
} from "./schema";

/**
 * City of Melbourne Pedestrian Counting System (CC BY), no key needed.
 * Cache policy: sensor list 24 h, hour-of-week history 24 h, live feed 15 min.
 */
const BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets";
const TIMEOUT_MS = 6_000;

function recordsUrl(dataset: string, params: Record<string, string>): string {
  return `${BASE}/${dataset}/records?${new URLSearchParams(params)}`;
}

export async function fetchSensors(): Promise<Sensor[]> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("footfall", "footfall:sensors");

  const url = recordsUrl("pedestrian-counting-system-sensor-locations", {
    select: "location_id, sensor_description, sensor_name, status, latitude, longitude",
    limit: "100",
    offset: "0",
  });
  const urlPage2 = recordsUrl("pedestrian-counting-system-sensor-locations", {
    select: "location_id, sensor_description, sensor_name, status, latitude, longitude",
    limit: "100",
    offset: "100",
  });
  const pages = await Promise.all(
    [url, urlPage2].map((u) => fetchJson(u, { adapter: "footfall", schema: sensorLocationsSchema, timeoutMs: TIMEOUT_MS })),
  );
  return pages
    .flatMap((page) => page.results)
    .filter((row) => row.status !== "I") // "I" marks inactive sensors
    .map((row) => ({
      id: row.location_id,
      name: row.sensor_description ?? row.sensor_name ?? `Sensor ${row.location_id}`,
      lat: row.latitude,
      lon: row.longitude,
    }));
}

/** Average hourly count per sensor over the given dates and hours. */
export async function fetchSlotAverages(
  dates: string[],
  startHour: number,
  endHour: number,
): Promise<Record<number, { avgHourly: number | null; samples: number }>> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("footfall", "footfall:history");

  const dateClause = dates.map((date) => `sensing_date = date'${date}'`).join(" or ");
  const url = recordsUrl("pedestrian-counting-system-monthly-counts-per-hour", {
    select: "location_id, avg(pedestriancount) as avg_count, count(*) as n",
    where: `(${dateClause}) and hourday >= ${startHour} and hourday < ${endHour}`,
    group_by: "location_id",
    limit: "200",
  });
  const body = await fetchJson(url, { adapter: "footfall", schema: slotAveragesSchema, timeoutMs: TIMEOUT_MS });
  return Object.fromEntries(
    body.results.map((row) => [row.location_id, { avgHourly: row.avg_count, samples: row.n }]),
  );
}

/** Pedestrians per sensor in the newest 60 minutes of the live per-minute feed. */
export async function fetchLiveCounts(): Promise<{ asOf: string | null; counts: Record<number, number> }> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag("footfall", "footfall:live");

  const dataset = "pedestrian-counting-system-past-hour-counts-per-minute";
  const latest = await fetchJson(recordsUrl(dataset, { select: "max(sensing_datetime) as latest" }), {
    adapter: "footfall",
    schema: latestSchema,
    timeoutMs: TIMEOUT_MS,
  });
  const asOf = latest.results[0]?.latest ?? null;
  if (!asOf) return { asOf: null, counts: {} };

  const since = new Date(new Date(asOf).getTime() - 60 * 60_000).toISOString().replace(".000Z", "+00:00");
  const body = await fetchJson(
    recordsUrl(dataset, {
      select: "location_id, sum(total_of_directions) as count",
      where: `sensing_datetime > date'${since}'`,
      group_by: "location_id",
      limit: "200",
    }),
    { adapter: "footfall", schema: liveCountsSchema, timeoutMs: TIMEOUT_MS },
  );
  return {
    asOf,
    counts: Object.fromEntries(
      body.results.filter((row) => row.count !== null).map((row) => [row.location_id, row.count as number]),
    ),
  };
}

const WEEKDAY_BY_ABBREVIATION: Record<string, string> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};
const WEEKDAY_EXPRESSION = "date_format(sensing_date, 'E')";

/**
 * Typical pedestrians per hour by sensor, weekday and hour, averaged over the
 * history window. One request for the whole week planner. The hourly history
 * has gaps (not every hour is present), so these average the hours that exist.
 */
export async function fetchTypicalByWeekdayHour(
  from: string,
  toExclusive: string,
  startHour: number,
  endHour: number,
): Promise<Record<number, Record<string, Record<number, number>>>> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("footfall", "footfall:typical");

  const url = `${BASE}/pedestrian-counting-system-monthly-counts-per-hour/exports/json?${new URLSearchParams({
    select: `location_id, hourday, ${WEEKDAY_EXPRESSION} as dow, avg(pedestriancount) as avg_count`,
    where: `sensing_date >= date'${from}' and sensing_date < date'${toExclusive}' and hourday >= ${startHour} and hourday < ${endHour}`,
    group_by: `location_id, hourday, ${WEEKDAY_EXPRESSION}`,
  })}`;
  const rows = await fetchJson(url, { adapter: "footfall", schema: typicalRowsSchema, timeoutMs: 12_000 });
  const out: Record<number, Record<string, Record<number, number>>> = {};
  for (const row of rows) {
    const abbreviation = row[WEEKDAY_EXPRESSION.replace(" ", "")];
    const weekday = typeof abbreviation === "string" ? WEEKDAY_BY_ABBREVIATION[abbreviation] : undefined;
    if (!weekday || row.avg_count === null) continue;
    ((out[row.location_id] ??= {})[weekday] ??= {})[row.hourday] = row.avg_count;
  }
  return out;
}
