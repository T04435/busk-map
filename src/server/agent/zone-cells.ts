import { distanceToLineM } from "@/lib/geo";
import type { PitchData } from "@/server/adapters/pitches";

/** The lattice the map draws taste cells on: one cell per precision-7 geohash width, pointy-top rows. */
const STEP_LON = 360 / 2 ** 18;
const STEP_LAT = 0.00094;
/** A cell is a no-busking cell when the council's no-busking street line passes within this of its centre. */
const NEAR_M = 55;
const MAX_CELLS = 320;

export type ZoneCell = { lat: number; lon: number };

/**
 * F16: the no-busking area as honeycomb cells (never a line or a polygon). The council's no-busking layer is street lines; each lattice
 * cell around the plan whose centre is close to one of them becomes a hatched cell. Display only: the rules still decide legality.
 */
export function noBuskingCells(data: Pick<PitchData, "zones">, around: { lat: number; lon: number }[], marginDeg = 0.012): ZoneCell[] {
  const lines = data.zones.filter((z) => z.kind === "no-busking").flatMap((z) => z.lines);
  if (lines.length === 0 || around.length === 0) return [];
  const minLat = Math.min(...around.map((p) => p.lat)) - marginDeg;
  const maxLat = Math.max(...around.map((p) => p.lat)) + marginDeg;
  const minLon = Math.min(...around.map((p) => p.lon)) - marginDeg;
  const maxLon = Math.max(...around.map((p) => p.lon)) + marginDeg;
  const near = lines.filter((line) => line.some((p) => p.lat > minLat - 0.002 && p.lat < maxLat + 0.002 && p.lon > minLon - 0.003 && p.lon < maxLon + 0.003));
  const cells: ZoneCell[] = [];
  for (let row = 0, lat = minLat; lat <= maxLat; row++, lat += STEP_LAT) {
    for (let lon = minLon + (row % 2 ? STEP_LON / 2 : 0); lon <= maxLon; lon += STEP_LON) {
      if (near.some((line) => distanceToLineM({ lat, lon }, line) <= NEAR_M)) cells.push({ lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) });
      if (cells.length >= MAX_CELLS) return cells;
    }
  }
  return cells;
}
