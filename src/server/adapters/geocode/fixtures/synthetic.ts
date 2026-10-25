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
  // The cities the Qloo mock's world map clusters in ("Where your fans are"), so a fans city resolves offline.
  { id: 9_000_007, name: "Havana", latitude: 23.13, longitude: -82.38, feature_code: "PPLA", country_code: "CU", country: "Cuba", admin1: "La Habana", timezone: "America/Havana", population: 1_000_000 },
  { id: 9_000_008, name: "Miami", latitude: 25.76, longitude: -80.19, feature_code: "PPLA", country_code: "US", country: "United States", admin1: "Florida", timezone: "America/New_York", population: 1_000_000 },
  { id: 9_000_009, name: "Mexico City", latitude: 19.43, longitude: -99.13, feature_code: "PPLA", country_code: "MX", country: "Mexico", admin1: "Mexico City", timezone: "America/Mexico_City", population: 1_000_000 },
  { id: 9_000_010, name: "Bogota", latitude: 4.711, longitude: -74.0721, feature_code: "PPLA", country_code: "CO", country: "Colombia", admin1: "Bogota D.C.", timezone: "America/Bogota", population: 1_000_000 },
  { id: 9_000_011, name: "Quito", latitude: -0.2299, longitude: -78.5249, feature_code: "PPLA", country_code: "EC", country: "Ecuador", admin1: "Pichincha", timezone: "America/Guayaquil", population: 1_000_000 },
  { id: 9_000_012, name: "Caracas", latitude: 10.488, longitude: -66.8792, feature_code: "PPLA", country_code: "VE", country: "Venezuela", admin1: "Capital District", timezone: "America/Caracas", population: 1_000_000 },
  { id: 9_000_013, name: "Buenos Aires", latitude: -34.6, longitude: -58.38, feature_code: "PPLA", country_code: "AR", country: "Argentina", admin1: "Buenos Aires F.D.", timezone: "America/Argentina/Buenos_Aires", population: 1_000_000 },
  { id: 9_000_014, name: "Sao Paulo", latitude: -23.55, longitude: -46.63, feature_code: "PPLA", country_code: "BR", country: "Brazil", admin1: "Sao Paulo", timezone: "America/Sao_Paulo", population: 1_000_000 },
  { id: 9_000_015, name: "Madrid", latitude: 40.42, longitude: -3.7, feature_code: "PPLA", country_code: "ES", country: "Spain", admin1: "Madrid", timezone: "Europe/Madrid", population: 1_000_000 },
  { id: 9_000_016, name: "Barcelona", latitude: 41.39, longitude: 2.17, feature_code: "PPLA", country_code: "ES", country: "Spain", admin1: "Catalonia", timezone: "Europe/Madrid", population: 1_000_000 },
  { id: 9_000_017, name: "Paris", latitude: 48.86, longitude: 2.35, feature_code: "PPLA", country_code: "FR", country: "France", admin1: "Ile-de-France", timezone: "Europe/Paris", population: 1_000_000 },
  { id: 9_000_018, name: "Berlin", latitude: 52.52, longitude: 13.4, feature_code: "PPLA", country_code: "DE", country: "Germany", admin1: "Berlin", timezone: "Europe/Berlin", population: 1_000_000 },
  { id: 9_000_019, name: "New York", latitude: 40.71, longitude: -74.01, feature_code: "PPLA", country_code: "US", country: "United States", admin1: "New York", timezone: "America/New_York", population: 1_000_000 },
  { id: 9_000_020, name: "Los Angeles", latitude: 34.05, longitude: -118.24, feature_code: "PPLA", country_code: "US", country: "United States", admin1: "California", timezone: "America/Los_Angeles", population: 1_000_000 },
  { id: 9_000_021, name: "Toronto", latitude: 43.65, longitude: -79.38, feature_code: "PPLA", country_code: "CA", country: "Canada", admin1: "Ontario", timezone: "America/Toronto", population: 1_000_000 },
  { id: 9_000_022, name: "Lagos", latitude: 6.52, longitude: 3.38, feature_code: "PPLA", country_code: "NG", country: "Nigeria", admin1: "Lagos", timezone: "Africa/Lagos", population: 1_000_000 },
  { id: 9_000_023, name: "Johannesburg", latitude: -26.2, longitude: 28.05, feature_code: "PPLA", country_code: "ZA", country: "South Africa", admin1: "Gauteng", timezone: "Africa/Johannesburg", population: 1_000_000 },
  { id: 9_000_024, name: "Mumbai", latitude: 19.08, longitude: 72.88, feature_code: "PPLA", country_code: "IN", country: "India", admin1: "Maharashtra", timezone: "Asia/Kolkata", population: 1_000_000 },
  { id: 9_000_025, name: "Seoul", latitude: 37.57, longitude: 126.98, feature_code: "PPLA", country_code: "KR", country: "South Korea", admin1: "Seoul", timezone: "Asia/Seoul", population: 1_000_000 },
  { id: 9_000_026, name: "Singapore", latitude: 1.35, longitude: 103.82, feature_code: "PPLA", country_code: "SG", country: "Singapore", admin1: "Singapore", timezone: "Asia/Singapore", population: 1_000_000 },
  { id: 9_000_027, name: "Sydney", latitude: -33.87, longitude: 151.21, feature_code: "PPLA", country_code: "AU", country: "Australia", admin1: "New South Wales", timezone: "Australia/Sydney", population: 1_000_000 },
  { id: 9_000_028, name: "Auckland", latitude: -36.85, longitude: 174.76, feature_code: "PPLA", country_code: "NZ", country: "New Zealand", admin1: "Auckland", timezone: "Pacific/Auckland", population: 1_000_000 },
];

/** The synthetic places whose name starts with the query, as the geocoder matches a prefix. */
export function syntheticGeocode(query: string): GeocodeResult[] {
  const q = query.trim().toLowerCase();
  return SYNTHETIC_GEOCODE.filter((r) => r.name.toLowerCase().startsWith(q));
}
