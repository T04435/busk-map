import "server-only";
import { citySlug, isTimeZone, type CityOption } from "@/lib/city";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { searchPlaces } from "./client";
import { syntheticGeocode } from "./fixtures/synthetic";
import type { GeocodeResult } from "./schema";

/** How many places the geocoder is asked for; non-cities are dropped from them. */
export const GEOCODE_ASK = 20;
/** How many cities the picker shows. */
export const GEOCODE_SHOWN = 8;

/** A geocoder row as a city the busk form can pick: populated places with a country and a known time zone only. */
export function cityOption(row: GeocodeResult): CityOption | null {
  if (!row.feature_code?.startsWith("PPL") || !row.country_code || !row.country || !row.timezone || !isTimeZone(row.timezone)) return null;
  const countryCode = row.country_code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  const place = { name: row.name.slice(0, 80), country: row.country.slice(0, 80), countryCode, lat: row.latitude, lon: row.longitude, timeZone: row.timezone };
  const region = row.admin1 ?? null;
  return { id: citySlug(place, region), ...place, region };
}

/** Cities from geocoder rows: one per slug (the first, best match), at most GEOCODE_SHOWN. */
export function cityOptions(rows: GeocodeResult[]): CityOption[] {
  const seen = new Set<string>();
  const out: CityOption[] = [];
  for (const row of rows) {
    const option = cityOption(row);
    if (!option || seen.has(option.id)) continue;
    seen.add(option.id);
    out.push(option);
    if (out.length === GEOCODE_SHOWN) break;
  }
  return out;
}

/** Cities whose name matches the query (Open-Meteo geocoding). Fallback: none, and the picker says search is down. */
export async function findCities(query: string, context: AdapterContext): Promise<AdapterResult<CityOption[]>> {
  return runAdapter({
    adapter: "geocode",
    source: "open-meteo",
    context,
    fallback: [],
    synthetic: () => cityOptions(syntheticGeocode(query)),
    live: async () => cityOptions(await searchPlaces(query, GEOCODE_ASK)),
    call: { endpoint: "/v1/search", params: { name: query, count: String(GEOCODE_ASK) } },
  });
}
