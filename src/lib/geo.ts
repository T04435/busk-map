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

/** Bounds of a geohash cell. */
export function geohashBounds(hash: string): BBox {
  const lat = [-90, 90];
  const lon = [-180, 180];
  let evenBit = true;
  for (const char of hash) {
    const value = GEOHASH_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Invalid geohash: ${hash}`);
    for (let bit = 4; bit >= 0; bit--) {
      const range = evenBit ? lon : lat;
      const mid = (range[0] + range[1]) / 2;
      if ((value >> bit) & 1) range[0] = mid;
      else range[1] = mid;
      evenBit = !evenBit;
    }
  }
  return { south: lat[0], north: lat[1], west: lon[0], east: lon[1] };
}

export function geohashCenter(hash: string): LatLon {
  const b = geohashBounds(hash);
  return { lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 };
}

/** Every geohash cell of the given precision that overlaps the box, west to east, south to north. */
export function geohashesInBBox(box: BBox, precision: number): string[] {
  const probe = geohashBounds(geohashEncode({ lat: box.south, lon: box.west }, precision));
  const dLat = probe.north - probe.south;
  const dLon = probe.east - probe.west;
  const out: string[] = [];
  for (let lat = probe.south + dLat / 2; lat - dLat / 2 < box.north; lat += dLat) {
    for (let lon = probe.west + dLon / 2; lon - dLon / 2 < box.east; lon += dLon) {
      out.push(geohashEncode({ lat, lon }, precision));
    }
  }
  return [...new Set(out)];
}

/** Ray-casting point-in-polygon for a single ring of [lon, lat] pairs. */
export function pointInRing({ lat, lon }: LatLon, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export type WktGeometry =
  | { type: "point"; point: LatLon }
  | { type: "polygon"; rings: [number, number][][] };

/**
 * Parse the WKT subset Qloo accepts for locations: POINT, POLYGON and
 * MULTIPOLYGON (outer rings only). Longitude first. Null when unreadable.
 */
export function parseWkt(text: string): WktGeometry | null {
  const value = text.trim();
  const point = /^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i.exec(value);
  if (point) return { type: "point", point: { lon: Number(point[1]), lat: Number(point[2]) } };
  if (!/^(MULTI)?POLYGON\s*\(/i.test(value)) return null;
  const rings: [number, number][][] = [];
  for (const match of value.matchAll(/\(\s*([-\d.\s,]+?)\s*\)/g)) {
    const ring = match[1].split(",").map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number]);
    if (ring.length < 3 || ring.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))) return null;
    rings.push(ring);
  }
  return rings.length > 0 ? { type: "polygon", rings } : null;
}

export function ringBBox(ring: readonly (readonly [number, number])[]): BBox {
  const lats = ring.map((p) => p[1]);
  const lons = ring.map((p) => p[0]);
  return { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lons), east: Math.max(...lons) };
}
