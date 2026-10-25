// SYNTHETIC FIXTURE: invented geocoder answers for tests and offline mode. Shaped like Open-Meteo's /v1/search results.
// Points and time zones are rounded public facts about each city; ids and populations are made up.
import type { GeocodeResult } from "../schema";

export const SYNTHETIC_GEOCODE: GeocodeResult[] = [
  { id: 9_000_001, name: "Melbourne", latitude: -37.814, longitude: 144.9633, feature_code: "PPLA", country_code: "AU", country: "Australia", admin1: "Victoria", timezone: "Australia/Melbourne", population: 4_000_000 },
  { id: 9_000_002, name: "Melbourne", latitude: 28.0836, longitude: -80.6081, feature_code: "PPL", country_code: "US", country: "United States", admin1: "Florida", timezone: "America/New_York", population: 80_000 },
  { id: 9_000_003, name: "Tokyo", latitude: 35.6895, longitude: 139.6917, feature_code: "PPLC", country_code: "JP", country: "Japan", admin1: "Tokyo", timezone: "Asia/Tokyo", population: 9_000_000 },
  { id: 9_000_004, name: "Tokyo Bay", latitude: 35.5, longitude: 139.8, feature_code: "BAY", country_code: "JP", country: "Japan", admin1: "Tokyo", timezone: "Asia/Tokyo" },
  { id: 9_000_005, name: "London", latitude: 51.5085, longitude: -0.1257, feature_code: "PPLC", country_code: "GB", country: "United Kingdom", admin1: "England", timezone: "Europe/London", population: 8_000_000 },
  { id: 9_000_006, name: "Lisbon", latitude: 38.7167, longitude: -9.1333, feature_code: "PPLC", country_code: "PT", country: "Portugal", admin1: "Lisbon", timezone: "Europe/Lisbon", population: 500_000 },
];

/** The synthetic places whose name starts with the query, as the geocoder matches a prefix. */
export function syntheticGeocode(query: string): GeocodeResult[] {
  const q = query.trim().toLowerCase();
  return SYNTHETIC_GEOCODE.filter((r) => r.name.toLowerCase().startsWith(q));
}
