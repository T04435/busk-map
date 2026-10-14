/** Small, dependency-free geo helpers. Coordinates are WGS84 degrees. */

export type LatLon = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance in metres from a point to a polyline. Uses a local equirectangular
 * projection, which is accurate to well under a metre at city scale.
 */
export function distanceToLineM(point: LatLon, line: readonly LatLon[]): number {
  if (line.length === 0) return Number.POSITIVE_INFINITY;
  if (line.length === 1) return distanceM(point, line[0]);
  const kx = Math.cos(toRad(point.lat)) * (Math.PI / 180) * EARTH_RADIUS_M;
  const ky = (Math.PI / 180) * EARTH_RADIUS_M;
  const project = (p: LatLon) => ({ x: (p.lon - point.lon) * kx, y: (p.lat - point.lat) * ky });
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length - 1; i++) {
    const a = project(line[i]);
    const b = project(line[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSq));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standard base-32 geohash. */
export function geohashEncode({ lat, lon }: LatLon, precision = 9): string {
  const latRange = [-90, 90];
  const lonRange = [-180, 180];
  let hash = "";
  let bits = 0;
  let value = 0;
  let evenBit = true;
  while (hash.length < precision) {
    const range = evenBit ? lonRange : latRange;
    const coordinate = evenBit ? lon : lat;
    const mid = (range[0] + range[1]) / 2;
    if (coordinate >= mid) {
      value = value * 2 + 1;
      range[0] = mid;
    } else {
      value *= 2;
      range[1] = mid;
    }
    evenBit = !evenBit;
    if (++bits === 5) {
      hash += GEOHASH_ALPHABET[value];
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

export type BBox = { south: number; west: number; north: number; east: number };

export function inBBox({ lat, lon }: LatLon, box: BBox): boolean {
  return lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;
}

/** WKT puts longitude first (Qloo's convention too). */
export function wktPoint({ lat, lon }: LatLon): string {
  return `POINT(${round(lon, 6)} ${round(lat, 6)})`;
}

export function wktPolygon(box: BBox): string {
  const ring = [
    [box.west, box.south],
    [box.east, box.south],
    [box.east, box.north],
    [box.west, box.north],
    [box.west, box.south],
  ]
    .map(([lon, lat]) => `${round(lon, 6)} ${round(lat, 6)}`)
    .join(", ");
  return `POLYGON((${ring}))`;
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
