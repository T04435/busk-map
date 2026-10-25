import { geohashBounds } from "@/lib/geo";
import { orangeCells } from "@/components/map/taste-cells";

/**
 * The taste layer's geometry, kept apart from MapLibre so it can be tested. A plan's cells come at one geohash precision (a
 * CBD-sized city, Melbourne) or two (a metro: the close-up district reads plus the coarse whole-area read). The finest
 * precision draws one honeycomb cell per geohash cell, exactly as before. Coarser cells are re-binned into one tidy pointy-top
 * hex lattice sized to their geohash cell's area (an even precision's cell is twice as wide as tall, so a hex as wide as the
 * cell stacked over its neighbours), each hex keeping its strongest cell; hexes that would overlap a close-up cell are left out.
 */
export type GridCell = { lat: number; lon: number; affinity: number; geohash: string | null };
export type Ring = number[][][];

/** A close-up cell without a geohash draws this wide (degrees of longitude, half). */
export const FALLBACK_HALF = 0.0015;
const M_PER_DEG_LAT = 110_574;
const mPerDegLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** A pointy-top hexagon around a cell centre, as wide as the geohash cell it replaces (`halfWidthDeg`, degrees of longitude). */
export function hexagon(lat: number, lon: number, halfWidthDeg: number): Ring {
  const r = halfWidthDeg / (Math.sqrt(3) / 2);
  const k = Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * (i % 6) - 90);
    return [lon + r * Math.cos(a), lat + r * Math.sin(a) * k];
  });
  return [ring];
}

/** Half a close-up cell's width (degrees of longitude): its geohash cell's, else the fallback. */
export const fineHalf = (c: GridCell) => (c.geohash ? (geohashBounds(c.geohash).east - geohashBounds(c.geohash).west) / 2 : FALLBACK_HALF);

/** The close-up cells (the finest geohash precision present, and any without a geohash) and the coarser ones. */
export function splitByPrecision<T extends GridCell>(cells: readonly T[]): { fine: T[]; coarse: T[] } {
  const finest = Math.max(0, ...cells.map((c) => c.geohash?.length ?? 0));
  const fine: T[] = [];
  const coarse: T[] = [];
  for (const c of cells) (c.geohash && c.geohash.length < finest ? coarse : fine).push(c);
  return { fine, coarse };
}

export type CoarseHex = { lat: number; lon: number; affinity: number; ring: Ring; /** Circumradius, metres. */ radiusM: number };

/** Whether (x, y) lies strictly inside a pointy-top hex of circumradius `r` centred on the origin. */
function insideHex(x: number, y: number, r: number): boolean {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return ax < (Math.sqrt(3) / 2) * r - 1e-9 && ay < r - ax / Math.sqrt(3) - 1e-9;
}

/**
 * The coarse cells as one non-overlapping pointy-top hex lattice (in metres around the cells' mean latitude): one hex has the
 * area of one geohash cell at the finest coarse precision. A hex takes the strongest of the cells whose centre falls in it and
 * of the cell its own centre falls in, so a row of cells is never skipped and a filled area has no holes. Hexes that would
 * overlap any close-up cell (`fine`, drawn or not: the plan zoomed in there) are dropped, and only the orange ones are returned.
 */
export function coarseHexGrid(coarse: readonly GridCell[], fine: readonly GridCell[] = []): CoarseHex[] {
  const withHash = coarse.filter((c): c is GridCell & { geohash: string } => !!c.geohash);
  if (withHash.length === 0) return [];
  const lat0 = withHash.reduce((s, c) => s + c.lat, 0) / withHash.length;
  const kx = mPerDegLon(lat0);
  const ky = M_PER_DEG_LAT;
  const precision = Math.max(...withHash.map((c) => c.geohash.length));
  const ref = geohashBounds(withHash.find((c) => c.geohash.length === precision)!.geohash);
  const area = (ref.east - ref.west) * kx * (ref.north - ref.south) * ky;
  const s = Math.sqrt(area / ((3 * Math.sqrt(3)) / 2));
  const SQ3 = Math.sqrt(3);
  // Axial coordinates of the pointy-top hex holding a point (cube rounding), and a hex's centre.
  const axial = (x: number, y: number): [number, number] => {
    const q = ((SQ3 / 3) * x - y / 3) / s;
    const r = ((2 / 3) * y) / s;
    const cz = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rz = Math.round(cz);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const dz = Math.abs(rz - cz);
    if (dq > dr && dq > dz) rq = -rr - rz;
    else if (dr > dz) rr = -rq - rz;
    return [rq, rr];
  };
  const centre = (q: number, r: number) => ({ x: s * (SQ3 * q + (SQ3 / 2) * r), y: s * 1.5 * r });
  const best = new Map<string, { q: number; r: number; affinity: number }>();
  const offer = (q: number, r: number, affinity: number) => {
    const key = `${q},${r}`;
    const cur = best.get(key);
    if (!cur || affinity > cur.affinity) best.set(key, { q, r, affinity });
  };
  for (const c of withHash) {
    const [q, r] = axial(c.lon * kx, c.lat * ky);
    offer(q, r, c.affinity);
    // Every hex whose centre lies in this cell's rectangle (the rectangle is at most a few hexes across).
    const b = geohashBounds(c.geohash);
    const reach = Math.ceil(Math.max((b.east - b.west) * kx, (b.north - b.south) * ky) / s) + 1;
    for (let dq = -reach; dq <= reach; dq++) {
      for (let dr = -reach; dr <= reach; dr++) {
        const p = centre(q + dq, r + dr);
        const lon = p.x / kx;
        const lat = p.y / ky;
        if (lon >= b.west && lon < b.east && lat >= b.south && lat < b.north) offer(q + dq, r + dr, c.affinity);
      }
    }
  }
  const fineDisks = fine.map((f) => ({ x: f.lon * kx, y: f.lat * ky, r: (fineHalf(f) / (SQ3 / 2)) * kx }));
  const out: CoarseHex[] = [];
  for (const { q, r, affinity } of best.values()) {
    const p = centre(q, r);
    // Two same-orientation hexes overlap exactly when one's centre lies inside a hex of their summed radii round the other.
    if (fineDisks.some((f) => insideHex(f.x - p.x, f.y - p.y, s + f.r))) continue;
    const ring = Array.from({ length: 7 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * (i % 6) - 90);
      return [(p.x + s * Math.cos(a)) / kx, (p.y + s * Math.sin(a)) / ky];
    });
    out.push({ lat: p.y / ky, lon: p.x / kx, affinity, ring: [ring], radiusM: s });
  }
  return orangeCells(out);
}

/** The two layers the plan map draws: the close-up cells (as before) and the coarse lattice, as GeoJSON features. */
export function tasteLayers(cells: readonly GridCell[]) {
  const { fine, coarse } = splitByPrecision(cells);
  const feature = (affinity: number, coordinates: Ring) => ({ type: "Feature" as const, properties: { affinity }, geometry: { type: "Polygon" as const, coordinates } });
  return {
    fine: { type: "FeatureCollection" as const, features: orangeCells(fine).map((c) => feature(c.affinity, hexagon(c.lat, c.lon, fineHalf(c)))) },
    coarse: { type: "FeatureCollection" as const, features: coarseHexGrid(coarse, fine).map((h) => feature(h.affinity, h.ring)) },
  };
}
