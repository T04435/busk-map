import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { fetchJson } from "../core";
import { parseFlag, parsePermit, parseRules, webMercatorToLatLon } from "./parse";
import { buskingPointsSchema, zoneGeoJsonSchema, type BuskingSite, type BuskingZone, type PitchData } from "./schema";

/**
 * City of Melbourne busking layers (public ArcGIS; licence not stated, credited).
 * Cache policy: 7 days.
 */
const POINTS_URL =
  "https://www.arcgis.com/sharing/rest/content/items/3991e11134634405bb8786d2b26425b8/data?f=json";
const ZONES_BASE = "https://services1.arcgis.com/KGdHCCUjGBpOPPac/arcgis/rest/services";
const TIMEOUT_MS = 8_000;

const zoneUrl = (service: string) =>
  `${ZONES_BASE}/${service}/FeatureServer/0/query?${new URLSearchParams({
    where: "1=1",
    outFields: "FID",
    outSR: "4326",
    f: "geojson",
  })}`;

export async function fetchPitchData(): Promise<PitchData> {
  "use cache: remote";
  cacheLife("weeks");
  cacheTag("pitches");

  const [points, unamplified, noBusking] = await Promise.all([
    fetchJson(POINTS_URL, { adapter: "pitches", schema: buskingPointsSchema, timeoutMs: TIMEOUT_MS }),
    fetchJson(zoneUrl("Unamplified_Busking_Permitted"), { adapter: "pitches", schema: zoneGeoJsonSchema, timeoutMs: TIMEOUT_MS }),
    fetchJson(zoneUrl("No_Busking_Permitted"), { adapter: "pitches", schema: zoneGeoJsonSchema, timeoutMs: TIMEOUT_MS }),
  ]);

  const sites: BuskingSite[] = points.layers[0].featureSet.features.map(({ geometry, attributes }) => ({
    id: `com-${attributes.FID}`,
    name: attributes.Location?.trim() || `Busking site ${attributes.FID}`,
    ...webMercatorToLatLon(geometry.x, geometry.y),
    permit: parsePermit(attributes.Permit_Typ),
    buskingAllowed: parseFlag(attributes.Busking_Al),
    musicAllowed: parseFlag(attributes.Music_Allo),
    circleActs: parseFlag(attributes.Circle_Act),
    ...parseRules(attributes.Descriptio),
  }));

  const toZones = (kind: BuskingZone["kind"], body: typeof unamplified): BuskingZone[] =>
    body.features.map((feature) => {
      const lines =
        feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      return {
        id: `${kind}-${feature.properties.FID}`,
        kind,
        lines: lines.map((line) => line.map(([lon, lat]) => ({ lat, lon }))),
      };
    });

  return { sites, zones: [...toZones("unamplified", unamplified), ...toZones("no-busking", noBusking)] };
}
