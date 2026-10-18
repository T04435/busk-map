/**
 * A small static gazetteer of major world cities, so "Where your fans are" can name the top places worldwide where Busk Map has no
 * planning area of its own (U30, the user's call of 19 Oct: the map is global). Coordinates are city centres to about 0.2 degrees.
 * Client-safe and pure. Also the backstop that keeps places out of "Your sound in genres" (lib/genre-tags.ts).
 */
export type WorldPlace = { name: string; country: string; lat: number; lon: number };

const p = (name: string, country: string, lat: number, lon: number): WorldPlace => ({ name, country, lat, lon });

export const WORLD_PLACES: readonly WorldPlace[] = [
  // Latin America and the Caribbean
  p("Havana", "Cuba", 23.13, -82.38),
  p("Santiago de Cuba", "Cuba", 20.02, -75.83),
  p("Mexico City", "Mexico", 19.43, -99.13),
  p("Guadalajara", "Mexico", 20.67, -103.35),
  p("Monterrey", "Mexico", 25.69, -100.32),
  p("Tijuana", "Mexico", 32.51, -117.04),
  p("Guatemala City", "Guatemala", 14.63, -90.51),
  p("San Salvador", "El Salvador", 13.69, -89.19),
  p("San Jose", "Costa Rica", 9.93, -84.08),
  p("Panama City", "Panama", 8.98, -79.52),
  p("San Juan", "Puerto Rico", 18.47, -66.11),
  p("Santo Domingo", "Dominican Republic", 18.49, -69.93),
  p("Kingston", "Jamaica", 17.97, -76.79),
  p("Port-au-Prince", "Haiti", 18.59, -72.31),
  p("Bogota", "Colombia", 4.71, -74.07),
  p("Medellin", "Colombia", 6.24, -75.58),
  p("Cali", "Colombia", 3.45, -76.53),
  p("Barranquilla", "Colombia", 10.96, -74.8),
  p("Caracas", "Venezuela", 10.48, -66.9),
  p("Quito", "Ecuador", -0.18, -78.47),
  p("Guayaquil", "Ecuador", -2.17, -79.92),
  p("Lima", "Peru", -12.05, -77.04),
  p("La Paz", "Bolivia", -16.5, -68.15),
  p("Santiago", "Chile", -33.45, -70.67),
  p("Buenos Aires", "Argentina", -34.6, -58.38),
  p("Cordoba", "Argentina", -31.42, -64.18),
  p("Rosario", "Argentina", -32.95, -60.64),
  p("Montevideo", "Uruguay", -34.9, -56.16),
  p("Asuncion", "Paraguay", -25.26, -57.58),
  p("Sao Paulo", "Brazil", -23.55, -46.63),
  p("Rio de Janeiro", "Brazil", -22.91, -43.17),
  p("Salvador", "Brazil", -12.97, -38.5),
  p("Brasilia", "Brazil", -15.79, -47.88),
  p("Belo Horizonte", "Brazil", -19.92, -43.94),
  p("Recife", "Brazil", -8.05, -34.88),
  p("Porto Alegre", "Brazil", -30.03, -51.23),
  // Spain and Portugal
  p("Madrid", "Spain", 40.42, -3.7),
  p("Barcelona", "Spain", 41.39, 2.17),
  p("Valencia", "Spain", 39.47, -0.38),
  p("Seville", "Spain", 37.39, -5.98),
  p("Bilbao", "Spain", 43.26, -2.93),
  p("Malaga", "Spain", 36.72, -4.42),
  p("Lisbon", "Portugal", 38.72, -9.14),
  p("Porto", "Portugal", 41.15, -8.61),
  // United States and Canada
  p("New York", "United States", 40.71, -74.01),
  p("Los Angeles", "United States", 34.05, -118.24),
  p("Chicago", "United States", 41.88, -87.63),
  p("Houston", "United States", 29.76, -95.37),
  p("Miami", "United States", 25.76, -80.19),
  p("Atlanta", "United States", 33.75, -84.39),
  p("Dallas", "United States", 32.78, -96.8),
  p("Austin", "United States", 30.27, -97.74),
  p("San Francisco", "United States", 37.77, -122.42),
  p("Seattle", "United States", 47.61, -122.33),
  p("Portland", "United States", 45.52, -122.68),
  p("Denver", "United States", 39.74, -104.99),
  p("Phoenix", "United States", 33.45, -112.07),
  p("Las Vegas", "United States", 36.17, -115.14),
  p("San Diego", "United States", 32.72, -117.16),
  p("Nashville", "United States", 36.16, -86.78),
  p("New Orleans", "United States", 29.95, -90.07),
  p("Boston", "United States", 42.36, -71.06),
  p("Philadelphia", "United States", 39.95, -75.17),
  p("Washington", "United States", 38.91, -77.04),
  p("Detroit", "United States", 42.33, -83.05),
  p("Minneapolis", "United States", 44.98, -93.27),
  p("Honolulu", "United States", 21.31, -157.86),
  p("Toronto", "Canada", 43.65, -79.38),
  p("Montreal", "Canada", 45.5, -73.57),
  p("Vancouver", "Canada", 49.28, -123.12),
  p("Calgary", "Canada", 51.05, -114.07),
  p("Ottawa", "Canada", 45.42, -75.7),
  // Europe
  p("London", "United Kingdom", 51.51, -0.13),
  p("Manchester", "United Kingdom", 53.48, -2.24),
  p("Birmingham", "United Kingdom", 52.49, -1.9),
  p("Glasgow", "United Kingdom", 55.86, -4.25),
  p("Edinburgh", "United Kingdom", 55.95, -3.19),
  p("Liverpool", "United Kingdom", 53.41, -2.99),
  p("Bristol", "United Kingdom", 51.45, -2.59),
  p("Dublin", "Ireland", 53.35, -6.26),
  p("Paris", "France", 48.86, 2.35),
  p("Marseille", "France", 43.3, 5.37),
  p("Lyon", "France", 45.76, 4.84),
  p("Berlin", "Germany", 52.52, 13.4),
  p("Hamburg", "Germany", 53.55, 9.99),
  p("Munich", "Germany", 48.14, 11.58),
  p("Cologne", "Germany", 50.94, 6.96),
  p("Frankfurt", "Germany", 50.11, 8.68),
  p("Amsterdam", "Netherlands", 52.37, 4.9),
  p("Rotterdam", "Netherlands", 51.92, 4.48),
  p("Brussels", "Belgium", 50.85, 4.35),
  p("Zurich", "Switzerland", 47.38, 8.54),
  p("Geneva", "Switzerland", 46.2, 6.14),
  p("Vienna", "Austria", 48.21, 16.37),
  p("Rome", "Italy", 41.9, 12.5),
  p("Milan", "Italy", 45.46, 9.19),
  p("Naples", "Italy", 40.85, 14.27),
  p("Turin", "Italy", 45.07, 7.69),
  p("Athens", "Greece", 37.98, 23.73),
  p("Istanbul", "Turkey", 41.01, 28.98),
  p("Ankara", "Turkey", 39.93, 32.86),
  p("Copenhagen", "Denmark", 55.68, 12.57),
  p("Stockholm", "Sweden", 59.33, 18.07),
  p("Gothenburg", "Sweden", 57.71, 11.97),
  p("Oslo", "Norway", 59.91, 10.75),
  p("Helsinki", "Finland", 60.17, 24.94),
  p("Reykjavik", "Iceland", 64.15, -21.94),
  p("Warsaw", "Poland", 52.23, 21.01),
  p("Krakow", "Poland", 50.06, 19.94),
  p("Prague", "Czechia", 50.08, 14.44),
  p("Budapest", "Hungary", 47.5, 19.04),
  p("Bucharest", "Romania", 44.43, 26.1),
  p("Sofia", "Bulgaria", 42.7, 23.32),
  p("Belgrade", "Serbia", 44.79, 20.45),
  p("Zagreb", "Croatia", 45.81, 15.98),
  p("Kyiv", "Ukraine", 50.45, 30.52),
  p("Moscow", "Russia", 55.76, 37.62),
  p("Saint Petersburg", "Russia", 59.93, 30.34),
  // Middle East and Africa
  p("Tel Aviv", "Israel", 32.09, 34.78),
  p("Beirut", "Lebanon", 33.89, 35.5),
  p("Amman", "Jordan", 31.95, 35.93),
  p("Cairo", "Egypt", 30.04, 31.24),
  p("Dubai", "United Arab Emirates", 25.2, 55.27),
  p("Riyadh", "Saudi Arabia", 24.71, 46.68),
  p("Tehran", "Iran", 35.69, 51.39),
  p("Casablanca", "Morocco", 33.57, -7.59),
  p("Marrakesh", "Morocco", 31.63, -8.0),
  p("Algiers", "Algeria", 36.75, 3.06),
  p("Tunis", "Tunisia", 36.81, 10.18),
  p("Dakar", "Senegal", 14.72, -17.47),
  p("Accra", "Ghana", 5.6, -0.19),
  p("Lagos", "Nigeria", 6.52, 3.38),
  p("Abuja", "Nigeria", 9.06, 7.49),
  p("Addis Ababa", "Ethiopia", 9.03, 38.74),
  p("Nairobi", "Kenya", -1.29, 36.82),
  p("Kampala", "Uganda", 0.35, 32.58),
  p("Kinshasa", "Democratic Republic of the Congo", -4.44, 15.27),
  p("Luanda", "Angola", -8.84, 13.23),
  p("Johannesburg", "South Africa", -26.2, 28.05),
  p("Cape Town", "South Africa", -33.92, 18.42),
  p("Durban", "South Africa", -29.86, 31.02),
  // Asia
  p("Mumbai", "India", 19.08, 72.88),
  p("Delhi", "India", 28.61, 77.21),
  p("Bangalore", "India", 12.97, 77.59),
  p("Chennai", "India", 13.08, 80.27),
  p("Kolkata", "India", 22.57, 88.36),
  p("Hyderabad", "India", 17.39, 78.49),
  p("Karachi", "Pakistan", 24.86, 67.01),
  p("Lahore", "Pakistan", 31.55, 74.34),
  p("Dhaka", "Bangladesh", 23.81, 90.41),
  p("Colombo", "Sri Lanka", 6.93, 79.86),
  p("Kathmandu", "Nepal", 27.72, 85.32),
  p("Bangkok", "Thailand", 13.76, 100.5),
  p("Hanoi", "Vietnam", 21.03, 105.85),
  p("Ho Chi Minh City", "Vietnam", 10.82, 106.63),
  p("Kuala Lumpur", "Malaysia", 3.14, 101.69),
  p("Singapore", "Singapore", 1.35, 103.82),
  p("Jakarta", "Indonesia", -6.21, 106.85),
  p("Bali", "Indonesia", -8.65, 115.22),
  p("Manila", "Philippines", 14.6, 120.98),
  p("Hong Kong", "China", 22.32, 114.17),
  p("Shenzhen", "China", 22.54, 114.06),
  p("Guangzhou", "China", 23.13, 113.26),
  p("Shanghai", "China", 31.23, 121.47),
  p("Beijing", "China", 39.9, 116.4),
  p("Chengdu", "China", 30.57, 104.07),
  p("Taipei", "Taiwan", 25.03, 121.57),
  p("Seoul", "South Korea", 37.57, 126.98),
  p("Busan", "South Korea", 35.18, 129.08),
  p("Tokyo", "Japan", 35.68, 139.69),
  p("Osaka", "Japan", 34.69, 135.5),
  p("Nagoya", "Japan", 35.18, 136.91),
  p("Sapporo", "Japan", 43.06, 141.35),
  p("Fukuoka", "Japan", 33.59, 130.4),
  p("Almaty", "Kazakhstan", 43.24, 76.95),
  p("Tashkent", "Uzbekistan", 41.3, 69.24),
  // Oceania
  p("Melbourne", "Australia", -37.81, 144.96),
  p("Sydney", "Australia", -33.87, 151.21),
  p("Brisbane", "Australia", -27.47, 153.03),
  p("Perth", "Australia", -31.95, 115.86),
  p("Adelaide", "Australia", -34.93, 138.6),
  p("Canberra", "Australia", -35.28, 149.13),
  p("Hobart", "Australia", -42.88, 147.33),
  p("Darwin", "Australia", -12.46, 130.84),
  p("Auckland", "New Zealand", -36.85, 174.76),
  p("Wellington", "New Zealand", -41.29, 174.78),
  p("Christchurch", "New Zealand", -43.53, 172.64),
  p("Suva", "Fiji", -18.14, 178.44),
];

const KM_PER_DEG = 111.2;

/** Great-circle-ish distance in km (equirectangular with a longitude wrap), enough to find the nearest city. */
function distKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = bLat - aLat;
  let dLon = Math.abs(bLon - aLon);
  if (dLon > 180) dLon = 360 - dLon;
  const x = dLon * Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + x * x) * KM_PER_DEG;
}

/** The nearest listed city to a point, and how far (km). */
export function nearestWorldPlace(point: { lat: number; lon: number }): { place: WorldPlace; km: number } {
  let best = { place: WORLD_PLACES[0], km: Infinity };
  for (const place of WORLD_PLACES) {
    const km = distKm(point.lat, point.lon, place.lat, place.lon);
    if (km < best.km) best = { place, km };
  }
  return best;
}

const duplicated = (() => {
  const count = new Map<string, number>();
  for (const w of WORLD_PLACES) count.set(w.name, (count.get(w.name) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([name]) => name));
})();

/** "Havana", with ", Country" only when two listed cities share the name. */
export const worldPlaceLabel = (w: WorldPlace): string => (duplicated.has(w.name) ? `${w.name}, ${w.country}` : w.name);

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PLACE_NAMES = new Set([...WORLD_PLACES.flatMap((w) => [norm(w.name), norm(w.country)])]);
/** Extra countries and regions that appear as Qloo location tags but have no listed city. */
for (const extra of ["usa", "us", "uk", "england", "scotland", "wales", "latin america", "europe", "asia", "africa", "oceania", "caribbean", "south america", "north america", "central america", "middle east", "cuba", "colombia", "chile", "ecuador", "venezuela", "bolivia", "cuba", "dominican republic", "puerto rico", "jamaica", "trinidad and tobago", "new zealand", "czech republic", "russia"]) PLACE_NAMES.add(extra);

/** True when a name is exactly a listed city, a country or a continent/region (used to keep places out of genre lists). */
export const isWorldPlaceName = (name: string): boolean => PLACE_NAMES.has(norm(name));
