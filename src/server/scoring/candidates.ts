import { distanceM, distanceToLineM, type LatLon } from "@/lib/geo";
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
/** A cell-centre pitch takes the name of a Qloo place within this distance. */
export const CELL_NAME_RADIUS_M = 400;
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

function cautionsFor(site: SiteInput | null, permit: PerformerPermit, unamplified: boolean): string[] {
  const cautions: string[] = [];
  if (site?.permit === "circle-act" && permit !== "circle-act") cautions.push("Circle act permit holders have priority here.");
  if (site?.permit === "chess-board") cautions.push("Special conditions apply; read the council's rules for this site.");
  if (site?.permit === "premium") cautions.push("Premium permit holders only.");
  if (!site) cautions.push("General permit: keep the required clearances from doors, crossings, seating and other buskers.");
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
};

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
    cautions: cautionsFor(null, permit, unamplified),
    usualSpot: usualSpotAt(point, hotspots),
  };
}

export function buildCandidatesWithFunnel({ sites, zones, spots, cells, hotspots, permit, generalRules = GENERAL_RULES, cellNames }: CandidateInputs): { candidates: Candidate[]; funnel: CandidateFunnel } {
  let considered = 0;
  let excluded = 0;
  const blocked = (point: LatLon) => ruledOut(point, sites, zones, permit);
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
    // No walkable spots for this city: each top cell's centre is a pitch.
    for (const cell of top) {
      const ref = { lat: cell.lat, lon: cell.lon, affinity: cell.affinity, rank: cell.rank };
      const near = cellNames
        .map((place) => ({ place, d: distanceM(cell, place) }))
        .filter((x) => x.d <= CELL_NAME_RADIUS_M)
        .sort((a, b) => a.d - b.d)[0]?.place;
      const id = `cell:${cell.geohash ?? `${cell.lat.toFixed(4)},${cell.lon.toFixed(4)}`}`;
      add({ id, name: near ? `Near ${near.name}` : `Taste area ${cell.rank}`, lat: cell.lat, lon: cell.lon, kind: "public-space", origin: "taste", cell: ref, ...general }, null);
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
