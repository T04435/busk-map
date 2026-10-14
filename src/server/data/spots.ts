/**
 * Walkable public spots in central Melbourne where a busker could stand:
 * squares, pedestrian streets, laneways, promenades, bridges and park edges.
 *
 * Names and coordinates are derived from OpenStreetMap (named
 * highway=pedestrian, place=square and leisure=park features, extracted
 * 2026-10-15 via the Overpass API): © OpenStreetMap contributors, ODbL 1.0,
 * https://www.openstreetmap.org/copyright. Private arcades and shopping
 * centres were left out by hand. The State Library and Flinders Street forecourts
 * were placed by hand at the building entrances. Being on this list says nothing about
 * legality: every spot still goes through the council's busking layers.
 */
import type { LatLon } from "@/lib/geo";

export type SpotKind = "square" | "pedestrian-street" | "laneway" | "promenade" | "bridge" | "park-edge" | "forecourt";

export type PublicSpot = LatLon & { id: string; name: string; kind: SpotKind };

const s = (id: string, name: string, kind: SpotKind, lat: number, lon: number): PublicSpot => ({ id: `osm:${id}`, name, kind, lat, lon });

export const PUBLIC_SPOTS: PublicSpot[] = [
  // Squares and plazas
  s("federation-square", "Federation Square", "square", -37.81777, 144.96931),
  s("city-square", "City Square", "square", -37.81593, 144.9671),
  s("st-james-plaza", "St James Plaza", "square", -37.81622, 144.95796),
  s("rialto-piazza", "Rialto Piazza", "square", -37.81853, 144.95777),
  s("les-erdi-plaza", "Les Erdi Plaza", "square", -37.81939, 144.96417),
  s("cohen-place-plaza", "Cohen Place Plaza", "square", -37.81118, 144.96931),
  s("piazza-italia", "Piazza Italia", "square", -37.80243, 144.96588),
  s("melbourne-square", "Melbourne Square", "square", -37.82025, 144.95199),
  s("lindsay-forecourt", "Lindsay Forecourt", "forecourt", -37.82254, 144.96933),
  s("state-library-forecourt", "State Library Victoria forecourt", "forecourt", -37.80985, 144.9646),
  s("flinders-street-steps", "Flinders Street Station steps", "forecourt", -37.8178, 144.96705),
  // Pedestrian streets and laneways
  s("bourke-street-mall", "Bourke Street Mall", "pedestrian-street", -37.81372, 144.96454),
  s("degraves-street", "Degraves Street", "laneway", -37.81744, 144.96583),
  s("centre-place", "Centre Place", "laneway", -37.81652, 144.96544),
  s("hardware-lane", "Hardware Lane", "laneway", -37.81382, 144.96132),
  s("equitable-place", "Equitable Place", "laneway", -37.81574, 144.96315),
  s("union-lane", "Union Lane", "laneway", -37.81397, 144.96456),
  s("alfred-place", "Alfred Place", "laneway", -37.81388, 144.97001),
  s("southern-cross-lane", "Southern Cross Lane", "laneway", -37.81301, 144.97019),
  s("madame-brussels-lane", "Madame Brussels Lane", "laneway", -37.80902, 144.97068),
  s("menzies-alley", "Menzies Alley", "laneway", -37.81063, 144.96201),
  s("albert-coates-lane", "Albert Coates Lane", "laneway", -37.81116, 144.96493),
  s("bowen-street", "Bowen Street", "pedestrian-street", -37.80825, 144.96438),
  s("queen-street-market", "Queen Street (market end)", "pedestrian-street", -37.8078, 144.95789),
  s("singers-walk", "Singers Walk", "pedestrian-street", -37.81108, 144.95652),
  s("custom-house-lane", "Custom House Lane", "laneway", -37.81937, 144.95884),
  s("old-treasury-walk", "Old Treasury Walk", "pedestrian-street", -37.81318, 144.97463),
  s("st-michaels-walk", "St Michaels Walk", "pedestrian-street", -37.81411, 144.96937),
  // River and harbour
  s("southbank-promenade-southgate", "Southbank Promenade (Southgate)", "promenade", -37.82015, 144.9661),
  s("southbank-promenade-arts", "Southbank Promenade (Arts Centre end)", "promenade", -37.8197, 144.97042),
  s("federation-wharf", "Federation Wharf", "promenade", -37.81879, 144.96934),
  s("enterprize-wharf", "Enterprize Wharf", "promenade", -37.82024, 144.96067),
  s("australian-wharf", "Australian Wharf", "promenade", -37.82247, 144.94579),
  s("victoria-harbour-promenade", "Victoria Harbour promenade", "promenade", -37.8188, 144.94504),
  s("william-barak-bridge", "William Barak Bridge", "bridge", -37.81837, 144.97662),
  s("tanderrum-bridge", "Tanderrum Bridge", "bridge", -37.81956, 144.97532),
  s("bourke-street-footbridge", "Bourke Street Footbridge", "bridge", -37.81801, 144.95054),
  // Parks and gardens (at the path edge)
  s("birrarung-marr", "Birrarung Marr", "park-edge", -37.81908, 144.97346),
  s("enterprize-park", "Enterprize Park", "park-edge", -37.82021, 144.95951),
  s("batman-park", "Batman Park", "park-edge", -37.8218, 144.9566),
  s("market-street-park", "Market Street Park", "park-edge", -37.81784, 144.96023),
  s("flagstaff-gardens", "Flagstaff Gardens (William St gate)", "park-edge", -37.81049, 144.95442),
  s("lincoln-square", "Lincoln Square", "park-edge", -37.80241, 144.9629),
  s("argyle-square", "Argyle Square", "park-edge", -37.80274, 144.96584),
  s("university-square", "University Square", "park-edge", -37.80108, 144.96038),
  s("eight-hour-reserve", "Eight Hour Reserve", "park-edge", -37.80732, 144.9655),
  s("wesley-place", "Wesley Place Urban Park", "park-edge", -37.80968, 144.96799),
  s("gordon-reserve", "Gordon Reserve", "park-edge", -37.81233, 144.97406),
  s("treasury-gardens", "Treasury Gardens", "park-edge", -37.81399, 144.97598),
  s("docklands-park", "Docklands Park", "park-edge", -37.82097, 144.94681),
  s("queen-victoria-gardens", "Queen Victoria Gardens", "park-edge", -37.82199, 144.97153),
  s("murchison-square", "Murchison Square", "park-edge", -37.80021, 144.97309),
];

/**
 * Melbourne's well-known busking hotspots: where buskers already go and where
 * a plain search or a tourist guide would send you. A pitch close to one
 * (scoring's USUAL_SPOT_RADIUS_M) is a "usual spot". Busk Map's own list.
 */
export const USUAL_HOTSPOTS: (LatLon & { name: string })[] = [
  { name: "Bourke Street Mall", lat: -37.81372, lon: 144.96454 },
  { name: "Federation Square", lat: -37.81777, lon: 144.96931 },
  { name: "Flinders Street Station", lat: -37.8178, lon: 144.96705 },
  { name: "Southbank Promenade at Southgate", lat: -37.82015, lon: 144.9661 },
  { name: "State Library Victoria", lat: -37.80985, lon: 144.9646 },
  { name: "Queen Victoria Market", lat: -37.8075, lon: 144.9572 },
  { name: "Melbourne Central (Swanston St)", lat: -37.8102, lon: 144.9632 },
];
