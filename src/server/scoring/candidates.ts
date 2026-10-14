import { distanceM, distanceToLineM, type LatLon } from "@/lib/geo";
import type { Candidate, PerformerPermit, SensorInput, SiteInput, ZoneInput } from "./types";

/**
 * Legal candidate pitches. Busk Map never claims a pitch is legal: these are
 * places the City of Melbourne's published layers do not rule out for the
 * performer's permit, with the conditions to check.
 *
 * - Designated sites: open to general permits (general, chess board, circle
 *   act with a priority caution), or premium sites for premium permit holders.
 *   Music must not be excluded.
 * - Footpaths: the general permit covers most CBD footpaths subject to
 *   clearances. Candidates sit at pedestrian sensors (busy footpaths with
 *   measured foot traffic), away from no-busking lines and restricted sites.
 */
export const NO_BUSKING_LINE_BUFFER_M = 30;
export const RESTRICTED_SITE_BUFFER_M = 60;
export const UNAMPLIFIED_LINE_BUFFER_M = 30;
export const MIN_CANDIDATE_SPACING_M = 60;

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
  if (!site) cautions.push("General permit footpath: keep the required clearances from doors, crossings and other buskers.");
  if (unamplified) cautions.push("Unamplified busking only.");
  return cautions;
}

export function buildCandidates(
  sites: SiteInput[],
  zones: ZoneInput[],
  sensors: SensorInput[],
  permit: PerformerPermit,
  options: { includeFootpaths: boolean } = { includeFootpaths: true },
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const site of sites) {
    if (!siteAllowsPerformer(site, permit)) continue;
    if (nearLines(site, zones, "no-busking", NO_BUSKING_LINE_BUFFER_M)) continue;
    const unamplified = nearLines(site, zones, "unamplified", UNAMPLIFIED_LINE_BUFFER_M);
    candidates.push({
      id: `site:${site.id}`,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      kind: "designated",
      amplification: unamplified ? "unamplified-zone" : "allowed",
      permit: site.permit,
      rules: site.rules,
      rulesUrl: site.rulesUrl,
      cautions: cautionsFor(site, permit, unamplified),
    });
  }

  if (options.includeFootpaths) {
    const restricted = sites.filter((s) => RESTRICTED.has(s.permit) && !siteAllowsPerformer(s, permit));
    for (const sensor of sensors) {
      if (nearLines(sensor, zones, "no-busking", NO_BUSKING_LINE_BUFFER_M)) continue;
      if (restricted.some((s) => distanceM(s, sensor) <= RESTRICTED_SITE_BUFFER_M)) continue;
      if (candidates.some((c) => distanceM(c, sensor) < MIN_CANDIDATE_SPACING_M)) continue;
      const unamplified = nearLines(sensor, zones, "unamplified", UNAMPLIFIED_LINE_BUFFER_M);
      candidates.push({
        id: `footpath:${sensor.id}`,
        name: `Footpath near ${sensor.name}`,
        lat: sensor.lat,
        lon: sensor.lon,
        kind: "footpath",
        amplification: unamplified ? "unamplified-zone" : "allowed",
        permit: "general",
        rules: "General busking permit; most CBD footpaths, subject to clearances.",
        rulesUrl: null,
        cautions: cautionsFor(null, permit, unamplified),
      });
    }
  }

  return candidates;
}
