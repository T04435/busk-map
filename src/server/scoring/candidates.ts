import { distanceM, distanceToLineM, type LatLon } from "@/lib/geo";
import { AREA_SAMPLE_KM } from "./areas";
import { isFineHeatmap } from "./heatmap";
import type { Candidate, HeatCellInput, HotspotInput, PerformerPermit, SiteInput, SpotInput, ZoneInput } from "./types";

/**
 * Candidate pitches come from the data, led by Qloo:
 *
 * 1. Take the performer's top taste cells from Qloo's heatmap.
 * 2. Snap each to the walkable public spots near its centre (squares,
 *    laneways, promenades; OpenStreetMap-derived).
 * 3. Add the council's designated sites open to the performer's permit: one
 *    input among others, not the driver.
 * 4. Add the well-known busking hotspots (USUAL_HOTSPOTS) to every list, so
 *    the score decides whether a usual spot beats the taste-led ones.
 * 5. Filter by legality: drop anything near a no-busking line or a site the
 *    performer can't use, flag unamplified zones, attach permit cautions.
 *
 * Busk Map never claims a pitch is legal: these are places the City of
 * Melbourne's published layers do not rule out, with the conditions to check.
 * The activity estimate and the other factors are applied when scoring.
 */
export const NO_BUSKING_LINE_BUFFER_M = 30;
export const RESTRICTED_SITE_BUFFER_M = 60;
export const UNAMPLIFIED_LINE_BUFFER_M = 30;
export const MIN_CANDIDATE_SPACING_M = 60;
/** Share of heatmap cells treated as "top" for the performer (at least MIN_TOP_CELLS). */
export const TOP_CELL_SHARE = 0.3;
export const MIN_TOP_CELLS = 4;
/** How far from a cell's centre a spot may be to stand for it (a geohash-6 cell is about 600 × 1,000 m). */
export const SNAP_RADIUS_M = 550;
/** ...and from a fine-grained (geohash-7, about 150 m) cell. */
export const FINE_SNAP_RADIUS_M = 250;
export const MAX_SPOTS_PER_CELL = 3;
export const USUAL_SPOT_RADIUS_M = 180;
/** A cell-centre pitch takes the name of a Qloo place within this distance (tasteSpotName). */
export const CELL_NAME_RADIUS_M = 400;
/** Cell-centre pitches: at most this many, at least this far apart (fine heatmap cells are 150 m, so neighbours would crowd the pool). */
export const MAX_CELL_PITCHES = 24;
export const CELL_PITCH_SPACING_M = 250;
/** Melbourne's general-permit rules line (the default). */
export const GENERAL_RULES = "General busking permit: most CBD footpaths and public spaces, subject to clearances.";

const RESTRICTED = new Set(["no-busking", "private", "pavement-art", "premium", "unknown"]);

export function nearLines(point: LatLon, zones: ZoneInput[], kind: ZoneInput["kind"], bufferM: number): boolean {
  return zones.some((zone) => zone.kind === kind && zone.lines.some((line) => distanceToLineM(point, line) <= bufferM));
}

export function siteAllowsPerformer(site: SiteInput, permit: PerformerPermit): boolean {
  if (site.musicAllowed === false) return false;
  switch (site.permit) {
    case "general":
    case "chess-board":
    case "circle-act":
      return true;
    case "premium":
      return permit === "premium";
    default:
      return false;
  }
}

/**
 * The cautions on a pitch. `councilRules` false: the city has no council busking layers (any city but Melbourne, V2 2.4), so
 * there is no general permit to keep clearances under: its rules line says they aren't checked instead.
 */
function cautionsFor(site: SiteInput | null, permit: PerformerPermit, unamplified: boolean, councilRules = true): string[] {
  const cautions: string[] = [];
  if (site?.permit === "circle-act" && permit !== "circle-act") cautions.push("Circle act permit holders have priority here.");
  if (site?.permit === "chess-board") cautions.push("Special conditions apply; read the council's rules for this site.");
  if (site?.permit === "premium") cautions.push("Premium permit holders only.");
  if (!site && councilRules) cautions.push("General permit: keep the required clearances from doors, crossings, seating and other buskers.");
  if (unamplified) cautions.push("Unamplified busking only.");
  return cautions;
}

/** The well-known hotspot a point sits at (the nearest one in range), if any. */
export function usualSpotAt(point: LatLon, hotspots: HotspotInput[]): string | null {
  let best: { name: string; d: number } | null = null;
  for (const h of hotspots) {
    const d = distanceM(point, h);
    if (d <= (h.radiusM ?? USUAL_SPOT_RADIUS_M) && (!best || d < best.d)) best = { name: h.name, d };
  }
  return best?.name ?? null;
}

/** A hotspot stands at the public spot within this distance, if any (so its pitch id is the spot's). */
export const HOTSPOT_SPOT_MATCH_M = 60;

const slug = (name: string) =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The performer's strongest cells, best first. */
export function topCells(cells: HeatCellInput[], share = TOP_CELL_SHARE): (HeatCellInput & { rank: number })[] {
  const count = Math.min(cells.length, Math.max(MIN_TOP_CELLS, Math.ceil(cells.length * share)));
  return [...cells]
    .sort((a, b) => b.affinity - a.affinity || a.lat - b.lat || a.lon - b.lon)
    .slice(0, count)
    .map((cell, i) => ({ ...cell, rank: i + 1 }));
}

export type CandidateInputs = {
  sites: SiteInput[];
  zones: ZoneInput[];
  spots: SpotInput[];
  cells: HeatCellInput[];
  hotspots: HotspotInput[];
  permit: PerformerPermit;
  /** The rules line for a pitch that isn't a council site (the city's, server/cities.ts rulesFor). Melbourne's by default. */
  generalRules?: string;
  /**
   * A city with no walkable spots (spots empty, no hotspots): the top taste cells themselves become the candidates, each named
   * after the nearest of these places (Qloo's busy places). The seam OSM pitches (V2 2.3) replace by filling `spots`.
   */
  cellNames?: (LatLon & { name: string })[];
  /** A metro's named areas, for those pitches' names (tasteSpotName). Empty or absent for a CBD-sized city. */
  areas?: readonly NamingArea[];
  /** The city's name, for a pitch with neither a named area nor a Qloo place near it. */
  city?: string;
  /** The city's centre and OpenStreetMap's named streets, to tell same-named cell pitches apart (tasteSpotName). */
  cityCenter?: LatLon;
  streets?: readonly (LatLon & { name: string })[];
};

/** A named area that lends its name to the points within its reach (AREA_SAMPLE_KM of its centre by default). */
export type NamingArea = LatLon & { name: string; reachM?: number };

export type TasteSpotNaming = {
  /** A metro's named areas (scoring/areas.ts); none for a CBD-sized city. */
  areas?: readonly NamingArea[];
  /** Qloo's busy places. */
  venues?: readonly (LatLon & { name: string })[];
  /** OpenStreetMap's named streets and public spaces, to tell two spots apart (never a pitch's own name). */
  streets?: readonly (LatLon & { name: string })[];
  city?: string;
  /** The city's centre: a spot nearer to it than to every named area takes the city's name; the compass hint's anchor. */
  cityCenter?: LatLon;
};

/** Two spots that would share a name are told apart by a street or place within this distance (tasteSpotName). */
export const TELL_APART_RADIUS_M = 800;

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;
/** Where `point` lies from `from`, on an 8-point compass; "centre" within 25 m. */
function compass(from: LatLon, point: LatLon): string {
  if (distanceM(from, point) < 25) return "centre";
  const dx = (point.lon - from.lon) * Math.cos((from.lat * Math.PI) / 180);
  const dy = point.lat - from.lat;
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(bearing / 45) % 8];
}

/**
 * The name of a pitch (or taste cell) Busk Map stood at a taste cell's centre, shared by the pitch cards, the map, the step
 * titles and the agent's copy:
 * - its area: with a metro's named areas, the one whose centre is nearest within its reach, else the nearest one at all
 *   (unless the city's centre is nearer: then the city); the city when there are no areas; none otherwise;
 * - its venue: the nearest Qloo place within CELL_NAME_RADIUS_M;
 * - "<Area> · near <Venue>", "Near <Venue>" (no areas), "<Area> taste spot" (no venue), "<City> taste spot" (neither).
 * A name already `taken` tries the next-nearest venue, then the nearest Qloo place or OpenStreetMap street within
 * TELL_APART_RADIUS_M, and only then a compass hint from its venue or its area's centre ("…, north"). Never an ordinal, never a bare number.
 */
export function tasteSpotName(point: LatLon, { areas = [], venues = [], streets = [], city, cityCenter }: TasteSpotNaming, taken: ReadonlySet<string> = new Set()): string {
  const byDistance = areas.map((a) => ({ a, d: distanceM(a, point) })).sort((x, y) => x.d - y.d);
  const inReach = byDistance.find((x) => x.d <= (x.a.reachM ?? AREA_SAMPLE_KM * 1000));
  const nearest = byDistance[0] && (!cityCenter || byDistance[0].d < distanceM(cityCenter, point)) ? byDistance[0] : undefined;
  const chosen = (inReach ?? nearest)?.a;
  const area = areas.length === 0 ? null : (chosen?.name ?? city ?? null);
  const closest = (places: readonly (LatLon & { name: string })[], radius: number) =>
    places
      .map((v) => ({ v, d: distanceM(v, point) }))
      .filter((x) => x.d <= radius && x.v.name.trim())
      .sort((x, y) => x.d - y.d || x.v.name.localeCompare(y.v.name))
      .map((x) => x.v);
  const within = (places: readonly (LatLon & { name: string })[], radius: number) => closest(places, radius).map((v) => v.name.trim());
  const near = within(venues, CELL_NAME_RADIUS_M);
  // The compass hint reads from what the name names: its venue, else its area's (or the city's) centre, else the nearest place.
  const anchor: LatLon | undefined = closest(venues, CELL_NAME_RADIUS_M)[0] ?? chosen ?? cityCenter ?? closest([...venues, ...streets], Infinity)[0];
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const label = (venue: string | undefined) =>
    venue ? (area && !same(area, venue) ? `${area} · near ${venue}` : `Near ${venue}`) : area || city ? `${area ?? city} taste spot` : "Taste spot";
  for (const venue of near) {
    const name = label(venue);
    if (!taken.has(name)) return name;
  }
  const base = label(near[0]);
  if (!taken.has(base)) return base;
  // Told apart by the nearest street or place a little further out.
  for (const place of within([...venues, ...streets], TELL_APART_RADIUS_M)) {
    const name = label(place);
    if (!taken.has(name)) return name;
  }
  // Last resort: a compass hint from the area's (or city's) centre, then with the distance, then the coordinates.
  const tries = anchor ? [compass(anchor, point), `${compass(anchor, point)}, ${(distanceM(anchor, point) / 1000).toFixed(1)} km`] : [];
  for (const hint of [...tries, `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`]) {
    const name = `${base}, ${hint}`;
    if (!taken.has(name)) return name;
  }
  return `${base}, ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
}

/** How the data narrowed down to the candidates, for the "how this plan was found" line. */
export type CandidateFunnel = {
  /** Qloo heatmap cells over the city, and how many were the performer's top cells. */
  cells: number;
  topCells: number;
  /** Public spots near the top cells, plus council sites open to the permit. */
  considered: number;
  /** Ruled out by no-busking lines or restricted sites. */
  excluded: number;
  candidates: number;
};

export function buildCandidates(inputs: CandidateInputs): Candidate[] {
  return buildCandidatesWithFunnel(inputs).candidates;
}

/** Whether the council's layers rule a point out for this permit (a no-busking line or a restricted site nearby). */
export function ruledOut(point: LatLon, sites: SiteInput[], zones: ZoneInput[], permit: PerformerPermit): boolean {
  return (
    nearLines(point, zones, "no-busking", NO_BUSKING_LINE_BUFFER_M) ||
    sites.some((s) => RESTRICTED.has(s.permit) && !siteAllowsPerformer(s, permit) && distanceM(s, point) <= RESTRICTED_SITE_BUFFER_M)
  );
}

/**
 * A candidate at any point the council's layers don't rule out (general
 * permit rules), for scoring a place named elsewhere, e.g. by the plain-AI
 * baseline. Null when the point is ruled out.
 */
export function candidateAt(
  point: LatLon & { id: string; name: string },
  { sites, zones, hotspots, permit, generalRules = GENERAL_RULES }: Pick<CandidateInputs, "sites" | "zones" | "hotspots" | "permit" | "generalRules">,
): Candidate | null {
  if (ruledOut(point, sites, zones, permit)) return null;
  const unamplified = nearLines(point, zones, "unamplified", UNAMPLIFIED_LINE_BUFFER_M);
  return {
    id: point.id,
    name: point.name,
    lat: point.lat,
    lon: point.lon,
    kind: "public-space",
    origin: "fallback",
    cell: null,
    permit: "general",
    rules: generalRules,
    rulesUrl: null,
    amplification: unamplified ? "unamplified-zone" : "allowed",
    cautions: cautionsFor(null, permit, unamplified, sites.length > 0 || zones.length > 0),
    usualSpot: usualSpotAt(point, hotspots),
  };
}

export function buildCandidatesWithFunnel({ sites, zones, spots, cells, hotspots, permit, generalRules = GENERAL_RULES, cellNames, areas, city, cityCenter, streets }: CandidateInputs): { candidates: Candidate[]; funnel: CandidateFunnel } {
  let considered = 0;
  let excluded = 0;
  const blocked = (point: LatLon) => ruledOut(point, sites, zones, permit);
  const councilRules = sites.length > 0 || zones.length > 0;
  const candidates: Candidate[] = [];
  const add = (candidate: Omit<Candidate, "amplification" | "cautions" | "usualSpot">, site: SiteInput | null) => {
    if (candidates.some((c) => c.id === candidate.id)) return;
    considered++;
    if (blocked(candidate)) {
      excluded++;
      return;
    }
    if (candidates.some((c) => distanceM(c, candidate) < MIN_CANDIDATE_SPACING_M)) return;
    const unamplified = nearLines(candidate, zones, "unamplified", UNAMPLIFIED_LINE_BUFFER_M);
    candidates.push({
      ...candidate,
      amplification: unamplified ? "unamplified-zone" : "allowed",
      cautions: cautionsFor(site, permit, unamplified, councilRules),
      usualSpot: usualSpotAt(candidate, hotspots),
    });
  };
  const general = { permit: "general" as const, rules: generalRules, rulesUrl: null };

  // Council-designated sites open to this permit: official, so they win spacing ties.
  for (const site of sites) {
    if (!siteAllowsPerformer(site, permit)) continue;
    add({ id: `site:${site.id}`, name: site.name, lat: site.lat, lon: site.lon, kind: "designated", origin: "council", cell: null, permit: site.permit, rules: site.rules, rulesUrl: site.rulesUrl }, site);
  }

  const fromSpot = (spot: SpotInput, origin: Candidate["origin"], cell: Candidate["cell"]) =>
    add({ id: `spot:${spot.id}`, name: spot.name, lat: spot.lat, lon: spot.lon, kind: "public-space", origin, cell, ...general }, null);

  const funnel = (top: number) => ({ candidates, funnel: { cells: cells.length, topCells: top, considered, excluded, candidates: candidates.length } });
  /**
   * Every hotspot, through the same legality filter and spacing: at its public
   * spot when one is that close (same id as the spot), else at its own point.
   * Added after the taste-led spots, so a spot already in the list keeps its cell.
   */
  const addHotspots = () => {
    for (const hotspot of hotspots) {
      const spot = spots.find((s) => distanceM(s, hotspot) <= HOTSPOT_SPOT_MATCH_M);
      if (spot) fromSpot(spot, "hotspot", null);
      else add({ id: `hotspot:${slug(hotspot.name)}`, name: hotspot.name, lat: hotspot.lat, lon: hotspot.lon, kind: "public-space", origin: "hotspot", cell: null, ...general }, null);
    }
  };

  if (cells.length === 0) {
    // No taste data: every public spot competes on the other factors.
    for (const spot of spots) fromSpot(spot, "fallback", null);
    addHotspots();
    return funnel(0);
  }

  const top = topCells(cells);
  if (spots.length === 0 && hotspots.length === 0 && cellNames) {
    // No walkable spots for this city: the top cells' centres are the pitches, spaced out.
    for (const cell of top) {
      if (candidates.length >= MAX_CELL_PITCHES) break;
      if (candidates.some((c) => distanceM(c, cell) < CELL_PITCH_SPACING_M)) continue;
      const ref = { lat: cell.lat, lon: cell.lon, affinity: cell.affinity, rank: cell.rank };
      const name = tasteSpotName(cell, { areas, venues: cellNames, city, cityCenter, streets }, new Set(candidates.map((c) => c.name)));
      // The id stays the cell's (its geohash): only the name reads like a place.
      const id = `cell:${cell.geohash ?? `${cell.lat.toFixed(4)},${cell.lon.toFixed(4)}`}`;
      add({ id, name, lat: cell.lat, lon: cell.lon, kind: "public-space", origin: "taste", cell: ref, ...general }, null);
    }
    return funnel(top.length);
  }
  const snapRadius = isFineHeatmap(cells) ? FINE_SNAP_RADIUS_M : SNAP_RADIUS_M;
  for (const cell of top) {
    const ref = { lat: cell.lat, lon: cell.lon, affinity: cell.affinity, rank: cell.rank };
    const near = <T extends LatLon>(items: T[]) =>
      items
        .map((item) => ({ item, d: distanceM(cell, item) }))
        .filter((x) => x.d <= snapRadius)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.item);
    for (const spot of near(spots).slice(0, MAX_SPOTS_PER_CELL)) fromSpot(spot, "taste", ref);
  }
  addHotspots();
  return funnel(top.length);
}
