import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { fetchJson } from "../core";
import { geocodeResponseSchema, geocodeResultSchema, type GeocodeResult } from "./schema";

/** Open-Meteo geocoding (GeoNames data, CC BY 4.0, no key). Cache policy: a week; place names barely change. */
const BASE = "https://geocoding-api.open-meteo.com/v1/search";
const TIMEOUT_MS = 5_000;

/** Places matching a name, best first. Rows that don't parse are dropped one by one, never the whole answer. */
export async function searchPlaces(name: string, count: number): Promise<GeocodeResult[]> {
  "use cache: remote";
  cacheLife("weeks");
  cacheTag("geocode");

  const params = new URLSearchParams({ name, count: String(count), language: "en", format: "json" });
  const body = await fetchJson(`${BASE}?${params}`, { adapter: "geocode", schema: geocodeResponseSchema, timeoutMs: TIMEOUT_MS });
  return (body.results ?? []).flatMap((row) => {
    const parsed = geocodeResultSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
