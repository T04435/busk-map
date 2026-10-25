import "server-only";
import type { City } from "@/lib/city";
import { pickAreas, type NamedArea } from "@/server/scoring/areas";
import { runAdapter, type AdapterContext } from "../core";
import { searchPlaces } from "../geocode/client";
import { syntheticGeocode } from "../geocode/fixtures/synthetic";
import { areasCall, fetchNamedAreasRecorded } from "./client";
import { syntheticAreas } from "./fixtures/synthetic";
import { areasFromGeocode, GEOCODE_AREAS_ASK, parseAreas } from "./query";

export { areaFromElement, areasCacheKey, areasFromGeocode, buildAreasQuery, parseAreas, populationOf, AREA_PLACES } from "./query";

/** Where a metro's named areas came from: OpenStreetMap, the geocoder (Overpass down or empty), or nowhere. */
export type AreasSource = "osm" | "geocode" | "none";

/**
 * The named areas a metro plan compares (scoring/areas.ts): the city itself, then up to MAX_AREAS - 1 suburbs, towns and
 * neighbourhoods inside its planning area. One Overpass query; when it fails or finds nothing, one geocoder search by the
 * city's name. Fallback: the city alone (source "none"), and the plan finds its districts at the heatmap's peaks.
 */
export async function findNamedAreas(city: Pick<City, "name" | "center" | "bbox">, context: AdapterContext): Promise<{ areas: NamedArea[]; source: AreasSource }> {
  const osm = await runAdapter<NamedArea[]>({
    adapter: "osm",
    source: "osm",
    context,
    fallback: [],
    synthetic: () => parseAreas(syntheticAreas(city).elements, city.bbox),
    live: () => fetchNamedAreasRecorded(city.bbox),
    call: areasCall(city.bbox),
  });
  if (osm.mode !== "fallback" && osm.data.length > 0) return { areas: pickAreas(osm.data, city), source: "osm" };
  const geo = await runAdapter<NamedArea[]>({
    adapter: "geocode",
    source: "open-meteo",
    context,
    fallback: [],
    synthetic: () => areasFromGeocode(syntheticGeocode(city.name), city.bbox),
    live: async () => areasFromGeocode(await searchPlaces(city.name, GEOCODE_AREAS_ASK), city.bbox),
    call: { endpoint: "/v1/search", params: { name: city.name, count: String(GEOCODE_AREAS_ASK) } },
  });
  const areas = pickAreas(geo.data, city);
  return { areas, source: areas.length > 1 ? "geocode" : "none" };
}
