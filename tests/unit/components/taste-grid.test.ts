import { describe, expect, it } from "vitest";
import { geohashBounds, geohashesInBBox, geohashCenter, type BBox } from "@/lib/geo";
import { coarseHexGrid, hexagon, splitByPrecision, tasteLayers, type GridCell } from "@/components/map/taste-grid";

/** Cells over a box at one precision, affinity from a smooth bump (all orange near the middle). */
function cellsIn(box: BBox, precision: number, affinity = (lat: number, lon: number) => 0.5 + 0.5 * Math.cos((lat - (box.south + box.north) / 2) * 20) * Math.cos((lon - (box.west + box.east) / 2) * 20)): GridCell[] {
  return geohashesInBBox(box, precision).map((geohash) => {
    const { lat, lon } = geohashCenter(geohash);
    return { lat, lon, geohash, affinity: Math.max(0, Math.min(1, affinity(lat, lon))) };
  });
}

const METRO: BBox = { south: 18.4, west: -70.05, north: 18.6, east: -69.8 };
const DISTRICT: BBox = { south: 18.46, west: -69.91, north: 18.48, east: -69.88 };
const M_LAT = 110_574;
const mLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Shoelace area of a ring in square metres (local projection). */
function areaM2(ring: number[][], lat: number): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * mLon(lat) * ring[i + 1][1] * M_LAT - ring[i + 1][0] * mLon(lat) * ring[i][1] * M_LAT;
  return Math.abs(a) / 2;
}

describe("taste grid", () => {
  it("draws a one-precision plan (Melbourne) as before: every cell close-up, one geohash-wide hex each, no coarse layer", () => {
    const cells = cellsIn({ south: -37.82, west: 144.95, north: -37.81, east: 144.97 }, 7, () => 0.9);
    const { fine, coarse } = splitByPrecision(cells);
    expect(coarse).toHaveLength(0);
    expect(fine).toHaveLength(cells.length);
    const layers = tasteLayers(cells);
    expect(layers.coarse.features).toHaveLength(0);
    const c = cells[0];
    const b = geohashBounds(c.geohash!);
    expect(layers.fine.features[0].geometry.coordinates).toEqual(hexagon(c.lat, c.lon, (b.east - b.west) / 2));
  });

  it("splits a metro's cells by precision: the finest are close-up, the rest coarse", () => {
    const cells = [...cellsIn(METRO, 6), ...cellsIn(DISTRICT, 7)];
    const { fine, coarse } = splitByPrecision(cells);
    expect(fine.every((c) => c.geohash!.length === 7)).toBe(true);
    expect(coarse.every((c) => c.geohash!.length === 6)).toBe(true);
  });

  for (const precision of [5, 6]) {
    it(`sizes coarse hexes to the geohash cell's area at precision ${precision}, and they never overlap`, () => {
      const box = precision === 5 ? { south: 18.2, west: -70.3, north: 18.8, east: -69.6 } : METRO;
      const cells = cellsIn(box, precision, () => 0.9);
      const hexes = coarseHexGrid(cells);
      expect(hexes.length).toBeGreaterThan(10);
      const b = geohashBounds(cells[0].geohash!);
      const cellArea = (b.east - b.west) * mLon(cells[0].lat) * (b.north - b.south) * M_LAT;
      for (const h of hexes.slice(0, 20)) expect(areaM2(h.ring[0], h.lat) / cellArea).toBeCloseTo(1, 1);
      // Same-size pointy-top hexes in one lattice: distinct centres at least √3·r apart (here measured at each hex's own latitude), so they only ever touch.
      const r = hexes[0].radiusM;
      for (let i = 0; i < hexes.length; i++) {
        for (let j = i + 1; j < hexes.length; j++) {
          const d = Math.hypot((hexes[i].lon - hexes[j].lon) * mLon(hexes[i].lat), (hexes[i].lat - hexes[j].lat) * M_LAT);
          expect(d).toBeGreaterThan(Math.sqrt(3) * r * 0.995);
        }
      }
    });
  }

  it("covers every orange coarse cell, with no holes inside a filled area", () => {
    const cells = cellsIn(METRO, 6, () => 0.9);
    const hexes = coarseHexGrid(cells);
    const r = hexes[0].radiusM;
    // Every cell centre is inside some hex (within its circumradius of a centre).
    for (const c of cells) {
      const near = hexes.some((h) => Math.hypot((h.lon - c.lon) * mLon(c.lat), (h.lat - c.lat) * M_LAT) <= r + 1);
      expect(near).toBe(true);
    }
  });

  it("dedupes: the same coarse cell twice (or a weaker copy) makes one hex with the strongest affinity", () => {
    const one = cellsIn(METRO, 6, () => 0.9);
    const twice = [...one, ...one.map((c) => ({ ...c, affinity: 0.6 }))];
    const a = coarseHexGrid(one);
    const b = coarseHexGrid(twice);
    expect(b).toHaveLength(a.length);
    expect(b.map((h) => h.affinity)).toEqual(a.map((h) => h.affinity));
  });

  it("hides coarse hexes under a zoomed district: none overlaps a close-up cell", () => {
    const fine = cellsIn(DISTRICT, 7);
    const coarse = cellsIn(METRO, 6, () => 0.9);
    const all = coarseHexGrid(coarse);
    const kept = coarseHexGrid(coarse, fine);
    expect(kept.length).toBeLessThan(all.length);
    const r = kept[0].radiusM;
    for (const f of fine) {
      const b = geohashBounds(f.geohash!);
      const fr = ((b.east - b.west) / 2 / (Math.sqrt(3) / 2)) * mLon(f.lat);
      for (const h of kept) {
        const x = Math.abs((f.lon - h.lon) * mLon(f.lat));
        const y = Math.abs((f.lat - h.lat) * M_LAT);
        const R = r + fr;
        const inside = x < (Math.sqrt(3) / 2) * R - 1 && y < R - x / Math.sqrt(3) - 1;
        expect(inside).toBe(false);
      }
    }
  });

  it("draws only orange coarse hexes", () => {
    const hexes = coarseHexGrid(cellsIn(METRO, 6, (lat) => (lat > 18.5 ? 0.9 : 0.2)));
    expect(hexes.length).toBeGreaterThan(0);
    expect(hexes.every((h) => h.affinity >= 0.48)).toBe(true);
  });
});
