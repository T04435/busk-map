import { boxAround } from "@/lib/city";
import { distanceM, type BBox, type LatLon } from "@/lib/geo";
import type { HeatCellInput } from "./types";

/**
 * Districts: how a metro-sized planning area (lib/city.ts isMetro, e.g. Miami with Miami Beach, Wynwood and Coral Gables) is
 * searched. Qloo's heatmap over the whole area is read coarsely (cells pooled into DISTRICT_BIN_KM squares, each keeping its
 * strongest cell), the strongest squares at least DISTRICT_MIN_SEPARATION_KM apart become up to MAX_DISTRICTS districts, and
 * each district gets the street-level work of a CBD plan: a zoomed heatmap and an OpenStreetMap search in its own small box.
 * Pure functions, no I/O (agent/context.ts runs the calls).
 */
export const MAX_DISTRICTS = 4;
/** Coarse squares the whole-area heatmap is pooled into (km). */
export const DISTRICT_BIN_KM = 1.5;
/** Two district centres are at least this far apart (km). */
export const DISTRICT_MIN_SEPARATION_KM = 2.5;
/** A district's box reaches this far from its centre each way (km): about a CBD's walkable core. */
export const DISTRICT_HALF_KM = 1.2;
/** At most this many of the plan's final pitches may come from one district. */
export const MAX_PICKS_PER_DISTRICT = 2;
/** A district takes the name of a known place within this distance of its centre. */
export const DISTRICT_NAME_M = 1500;

export type District = {
  /** "d1" for the strongest, then "d2", … */
  id: string;
  /** The nearest known place (an OpenStreetMap spot or a Qloo place), else "Area N". */
  name: string;
  center: LatLon;
  bbox: BBox;
  /** The strongest coarse cell's affinity. */
  affinity: number;
  /** Seeded by a named area (scoring/areas.ts districtsFromAreas): it already has its name. */
  area?: boolean;
};

type Coarse = LatLon & { affinity: number };

const KM_PER_DEG = 111.32;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** The heatmap pooled into squares of `binKm`: one per square, at its strongest cell, best first. */
export function coarseCells(cells: readonly HeatCellInput[], binKm = DISTRICT_BIN_KM): Coarse[] {
  if (cells.length === 0) return [];
  const lat0 = cells.reduce((s, c) => s + c.lat, 0) / cells.length;
  const dLat = binKm / KM_PER_DEG;
  const dLon = binKm / (KM_PER_DEG * Math.max(0.05, Math.cos((lat0 * Math.PI) / 180)));
  const bins = new Map<string, Coarse>();
  for (const cell of cells) {
    const key = `${Math.floor(cell.lat / dLat)}:${Math.floor(cell.lon / dLon)}`;
    const best = bins.get(key);
    if (!best || cell.affinity > best.affinity || (cell.affinity === best.affinity && (cell.lat < best.lat || (cell.lat === best.lat && cell.lon < best.lon)))) {
      bins.set(key, { lat: cell.lat, lon: cell.lon, affinity: cell.affinity });
    }
  }
  return [...bins.values()].sort((a, b) => b.affinity - a.affinity || a.lat - b.lat || a.lon - b.lon);
}

/** A box clipped to the planning area. */
function clip(box: BBox, area: BBox): BBox {
  return { south: Math.max(box.south, area.south), west: Math.max(box.west, area.west), north: Math.min(box.north, area.north), east: Math.min(box.east, area.east) };
}

/**
 * The districts of a metro area from its whole-area heatmap: going down the coarse squares best first, a square becomes a
 * district unless it lies within `minSeparationKm` of one already chosen, until `max`. Each district's box is
 * DISTRICT_HALF_KM around its centre, clipped to the area. Named "Area N" until nameDistricts.
 */
export function findDistricts(
  cells: readonly HeatCellInput[],
  area: BBox,
  { max = MAX_DISTRICTS, minSeparationKm = DISTRICT_MIN_SEPARATION_KM, binKm = DISTRICT_BIN_KM, halfKm = DISTRICT_HALF_KM } = {},
): District[] {
  const picked: Coarse[] = [];
  for (const cell of coarseCells(cells, binKm)) {
    if (picked.length >= max) break;
    if (picked.every((p) => distanceM(p, cell) >= minSeparationKm * 1000)) picked.push(cell);
  }
  return picked.map((cell, i) => {
    const center = { lat: r4(cell.lat), lon: r4(cell.lon) };
    return { id: `d${i + 1}`, name: `Area ${i + 1}`, center, bbox: clip(boxAround(center, halfKm, halfKm), area), affinity: cell.affinity };
  });
}

/** The district a point belongs to: the one whose centre is nearest. Null with no districts. */
export function districtOf(point: LatLon, districts: readonly Pick<District, "id" | "center">[]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const district of districts) {
    const d = distanceM(point, district.center);
    if (!best || d < best.d) best = { id: district.id, d };
  }
  return best?.id ?? null;
}

/**
 * Each district named after the nearest named place within DISTRICT_NAME_M of its centre (OpenStreetMap spots first, then
 * Qloo's places), else "Area N". Two districts never share a name: the second nearest is "Area N" too.
 */
export function nameDistricts(districts: readonly District[], ...sources: readonly (readonly (LatLon & { name: string })[])[]): District[] {
  const used = new Set<string>();
  return districts.map((district, i) => {
    for (const source of sources) {
      const near = source
        .map((p) => ({ p, d: distanceM(p, district.center) }))
        .filter((x) => x.d <= DISTRICT_NAME_M && !used.has(x.p.name) && !/^(Pedestrian street|Public square|Promenade|Park|Laneway|Footbridge|Station forecourt)$/.test(x.p.name))
        .sort((a, b) => a.d - b.d || a.p.name.localeCompare(b.p.name))[0];
      if (near) {
        used.add(near.p.name);
        return { ...district, name: near.p.name };
      }
    }
    return { ...district, name: `Area ${i + 1}` };
  });
}
