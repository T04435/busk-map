import type { BBox, LatLon } from "@/lib/geo";

/**
 * Supported cities. Melbourne is the demo city: it is the only one with live,
 * free foot traffic and machine-readable busking rules (spec.md).
 */
export type CityId = "melbourne";

export type CityConfig = {
  id: CityId;
  name: string;
  countryCode: string;
  timeZone: string;
  center: LatLon;
  /** The area we plan for: Melbourne CBD, Southbank and Docklands (sensor coverage). */
  bbox: BBox;
  /** Data levels available here, shown in the UI. */
  footfallLevel: "city-sensors" | "qloo-popularity";
  pitchRules: "machine-readable" | "unavailable";
  rulesUrl: string;
};

export const CITIES: Record<CityId, CityConfig> = {
  melbourne: {
    id: "melbourne",
    name: "Melbourne",
    countryCode: "AU",
    timeZone: "Australia/Melbourne",
    center: { lat: -37.8136, lon: 144.9631 },
    bbox: { south: -37.8265, west: 144.9365, north: -37.7985, east: 144.9845 },
    footfallLevel: "city-sensors",
    pitchRules: "machine-readable",
    rulesUrl: "https://www.melbourne.vic.gov.au/busking",
  },
};

export const CITY_IDS = Object.keys(CITIES) as CityId[];
