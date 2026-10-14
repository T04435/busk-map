import { distanceM, distanceToLineM, type LatLon } from "@/lib/geo";
import type { Candidate, HeatCellInput, HotspotInput, PerformerPermit, SensorInput, SiteInput, SpotInput, ZoneInput } from "./types";

/**
 * Candidate pitches come from the data, led by Qloo:
 *
 * 1. Take the performer's top taste cells from Qloo's heatmap.
 * 2. Snap each to the walkable public spots near its centre (squares,
 *    laneways, promenades; OpenStreetMap-derived) and to the nearest
 *    pedestrian sensor (a footpath with measured foot traffic).
 * 3. Add the council's designated sites open to the performer's permit: one
 *    input among others, not the driver.
 * 4. Filter by legality: drop anything near a no-busking line or a site the
 *    performer can't use, flag unamplified zones, attach permit cautions.
 *
 * Busk Map never claims a pitch is legal: these are places the City of
 * Melbourne's published layers do not rule out, with the conditions to check.
 * Foot traffic and the other factors are applied when scoring.
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
export const MAX_SPOTS_PER_CELL = 3;
export const USUAL_SPOT_RADIUS_M = 180;

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

function cautionsFor(site: SiteInput | null, permit: PerformerPermit, unamplified: boolean): string[] {
  const cautions: string[] = [];
  if (site?.permit === "circle-act" && permit !== "circle-act") cautions.push("Circle act permit holders have priority here.");
  if (site?.permit === "chess-board") cautions.push("Special conditions apply; read the council's rules for this site.");
  if (site?.permit === "premium") cautions.push("Premium permit holders only.");
  if (!site) cautions.push("General permit: keep the required clearances from doors, crossings, seating and other buskers.");
  if (unamplified) cautions.push("Unamplified busking only.");
  return cautions;
}

/** The well-known hotspot a point sits at, if any. */
export function usualSpotAt(point: LatLon, hotspots: HotspotInput[]): string | null {
  return hotspots.find((h) => distanceM(point, h) <= USUAL_SPOT_RADIUS_M)?.name ?? null;
}

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
  sensors: SensorInput[];
  spots: SpotInput[];
  cells: HeatCellInput[];
  hotspots: HotspotInput[];
  permit: PerformerPermit;
};

/** How the data narrowed down to the candidates, for the "how this plan was found" line. */
export type CandidateFunnel = {
  /** Qloo heatmap cells over the city, and how many were the performer's top cells. */
  cells: number;
  topCells: number;
  /** Public spots and sensor footpaths near the top cells, plus council sites open to the permit. */
  considered: number;
  /** Ruled out by no-busking lines or restricted sites. */
  excluded: number;
  candidates: number;
};

export function buildCandidates(inputs: CandidateInputs): Candidate[] {
  return buildCandidatesWithFunnel(inputs).candidates;
}

export function buildCandidatesWithFunnel({ sites, zones, sensors, spots, cells, hotspots, permit }: CandidateInputs): { candidates: Candidate[]; funnel: CandidateFunnel } {
  let considered = 0;
  let excluded = 0;
  const restricted = sites.filter((s) => RESTRICTED.has(s.permit) && !siteAllowsPerformer(s, permit));
  const blocked = (point: LatLon) =>
    nearLines(point, zones, "no-busking", NO_BUSKING_LINE_BUFFER_M) || restricted.some((s) => distanceM(s, point) <= RESTRICTED_SITE_BUFFER_M);
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
      cautions: cautionsFor(site, permit, unamplified),
      usualSpot: usualSpotAt(candidate, hotspots),
    });
  };
  const general = { permit: "general" as const, rules: "General busking permit: most CBD footpaths and public spaces, subject to clearances.", rulesUrl: null };

  // Council-designated sites open to this permit: official, so they win spacing ties.
  for (const site of sites) {
    if (!siteAllowsPerformer(site, permit)) continue;
    add({ id: `site:${site.id}`, name: site.name, lat: site.lat, lon: site.lon, kind: "designated", origin: "council", cell: null, permit: site.permit, rules: site.rules, rulesUrl: site.rulesUrl }, site);
  }

  const fromSpot = (spot: SpotInput, origin: Candidate["origin"], cell: Candidate["cell"]) =>
    add({ id: `spot:${spot.id}`, name: spot.name, lat: spot.lat, lon: spot.lon, kind: "public-space", origin, cell, ...general }, null);
  const fromSensor = (sensor: SensorInput, origin: Candidate["origin"], cell: Candidate["cell"]) =>
    add({ id: `footpath:${sensor.id}`, name: `Footpath near ${sensor.name}`, lat: sensor.lat, lon: sensor.lon, kind: "footpath", origin, cell, ...general }, null);

  const funnel = (top: number) => ({ candidates, funnel: { cells: cells.length, topCells: top, considered, excluded, candidates: candidates.length } });

  if (cells.length === 0) {
    // No taste data: every public spot and sensor footpath competes on the other factors.
    for (const spot of spots) fromSpot(spot, "fallback", null);
    for (const sensor of sensors) fromSensor(sensor, "fallback", null);
    return funnel(0);
  }

  const top = topCells(cells);
  for (const cell of top) {
    const ref = { lat: cell.lat, lon: cell.lon, affinity: cell.affinity, rank: cell.rank };
    const near = <T extends LatLon>(items: T[]) =>
      items
        .map((item) => ({ item, d: distanceM(cell, item) }))
        .filter((x) => x.d <= SNAP_RADIUS_M)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.item);
    for (const spot of near(spots).slice(0, MAX_SPOTS_PER_CELL)) fromSpot(spot, "taste", ref);
    const [sensor] = near(sensors);
    if (sensor) fromSensor(sensor, "taste", ref);
  }
  return funnel(top.length);
}
