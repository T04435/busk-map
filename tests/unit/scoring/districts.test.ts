import { describe, expect, it } from "vitest";
import { boxAround } from "@/lib/city";
import { distanceM, inBBox, type LatLon } from "@/lib/geo";
import {
  coarseCells,
  DISTRICT_MIN_SEPARATION_KM,
  districtOf,
  findDistricts,
  MAX_DISTRICTS,
  MAX_PICKS_PER_DISTRICT,
  nameDistricts,
  pickTopPitches,
  type ScoredPitch,
} from "@/server/scoring";

/** A Miami-sized metro (invented cells): a 20 km box around a centre. */
const CENTER = { lat: 25.7617, lon: -80.1918 };
const AREA = boxAround(CENTER, 10, 10);
const KM_LAT = 1 / 111.32;
const KM_LON = 1 / (111.32 * Math.cos((CENTER.lat * Math.PI) / 180));
const at = (northKm: number, eastKm: number): LatLon => ({ lat: CENTER.lat + northKm * KM_LAT, lon: CENTER.lon + eastKm * KM_LON });
const cell = (p: LatLon, affinity: number) => ({ ...p, affinity, geohash: null });

/** Five hot spots: two downtown 1 km apart, then beach, north and south-west, and a weak far one. */
const CELLS = [
  cell(at(0, 0), 1),
  cell(at(0.9, 0.3), 0.97),
  cell(at(0.2, 5), 0.9),
  cell(at(4, -0.5), 0.8),
  cell(at(-5, -6), 0.75),
  cell(at(8, 8), 0.2),
  // Weak cells around the strongest, in the same coarse square.
  cell(at(0.1, 0.1), 0.3),
  cell(at(-0.2, 0.2), 0.25),
];

describe("districts of a metro", () => {
  it("pools the heatmap into coarse squares, each at its strongest cell, best first", () => {
    const coarse = coarseCells(CELLS);
    expect(coarse.length).toBeLessThan(CELLS.length);
    expect(coarse[0]).toMatchObject({ affinity: 1 });
    for (let i = 1; i < coarse.length; i++) expect(coarse[i].affinity).toBeLessThanOrEqual(coarse[i - 1].affinity);
    expect(coarseCells([])).toEqual([]);
  });

  it("takes the strongest squares at least the minimum separation apart, at most MAX_DISTRICTS", () => {
    const districts = findDistricts(CELLS, AREA);
    expect(districts).toHaveLength(MAX_DISTRICTS);
    expect(districts.map((d) => d.id)).toEqual(["d1", "d2", "d3", "d4"]);
    // The second downtown cell (1 km from the first) is not a district of its own.
    expect(districts.map((d) => d.affinity)).toEqual([1, 0.9, 0.8, 0.75]);
    for (let i = 0; i < districts.length; i++)
      for (let j = i + 1; j < districts.length; j++) expect(distanceM(districts[i].center, districts[j].center)).toBeGreaterThanOrEqual(DISTRICT_MIN_SEPARATION_KM * 1000);
    for (const d of districts) {
      expect(inBBox(d.center, d.bbox)).toBe(true);
      // A district's box is a CBD's walkable core: about 2.4 km across.
      expect((d.bbox.north - d.bbox.south) / KM_LAT).toBeCloseTo(2.4, 1);
      expect(d.name).toMatch(/^Area \d$/);
    }
  });

  it("finds fewer districts when the taste sits in one place, and none without cells", () => {
    expect(findDistricts([cell(at(0, 0), 1), cell(at(0.5, 0.5), 0.9), cell(at(-0.4, 0.3), 0.8)], AREA)).toHaveLength(1);
    expect(findDistricts([], AREA)).toEqual([]);
    expect(findDistricts(CELLS, AREA, { max: 2 })).toHaveLength(2);
    expect(findDistricts(CELLS, AREA, { minSeparationKm: 20 })).toHaveLength(1);
  });

  it("clips a district's box to the planning area", () => {
    const edge = { ...at(9.9, 9.9) };
    const [d] = findDistricts([cell(edge, 1)], AREA);
    expect(d.bbox.north).toBeLessThanOrEqual(AREA.north);
    expect(d.bbox.east).toBeLessThanOrEqual(AREA.east);
  });

  it("puts a point in the district with the nearest centre", () => {
    const districts = findDistricts(CELLS, AREA);
    expect(districtOf(at(0.3, 0.3), districts)).toBe("d1");
    expect(districtOf(at(0.5, 4.5), districts)).toBe("d2");
    expect(districtOf(at(0, 0), [])).toBeNull();
  });

  it("names districts after the nearest named place, never twice, else Area N", () => {
    const districts = findDistricts(CELLS, AREA);
    const spots = [
      { name: "Bayfront Park", ...at(0.3, 0.2) },
      { name: "Pedestrian street", ...at(0.2, 5) },
      { name: "Lummus Park", ...at(0.4, 5.2) },
    ];
    const places = [{ name: "Wynwood Walls", ...at(4.2, -0.4) }, { name: "Bayfront Park", ...at(0.1, 0) }];
    const named = nameDistricts(districts, spots, places);
    expect(named.map((d) => d.name)).toEqual(["Bayfront Park", "Lummus Park", "Wynwood Walls", "Area 4"]);
    expect(named.map((d) => d.id)).toEqual(districts.map((d) => d.id));
  });
});

describe("spreading the top 3 over districts", () => {
  const pitch = (id: string, p: LatLon, score: number) => ({ id, name: id, ...p, score }) as unknown as ScoredPitch;
  // Downtown has the three best pitches (all more than 250 m apart); the beach and the north come after.
  const RANKED = [pitch("down-1", at(0, 0), 90), pitch("down-2", at(0.5, 0.2), 88), pitch("down-3", at(-0.5, -0.3), 86), pitch("beach", at(0.2, 5), 80), pitch("north", at(4, -0.5), 70)];
  const districts = findDistricts(CELLS, AREA);
  const spread = { districtOf: (p: LatLon) => districtOf(p, districts), maxPerDistrict: MAX_PICKS_PER_DISTRICT };

  it("takes at most 2 from one district while another district has a pitch", () => {
    expect(pickTopPitches(RANKED, 3).map((p) => p.id)).toEqual(["down-1", "down-2", "down-3"]);
    expect(pickTopPitches(RANKED, 3, undefined, spread).map((p) => p.id)).toEqual(["down-1", "down-2", "beach"]);
  });

  it("fills from the best left when only one district has pitches, so a plan still has 3", () => {
    const oneDistrict = RANKED.slice(0, 3);
    expect(pickTopPitches(oneDistrict, 3, undefined, spread).map((p) => p.id)).toEqual(["down-1", "down-2", "down-3"]);
  });

  it("still keeps the 250 m spacing", () => {
    const crowded = [pitch("a", at(0, 0), 90), pitch("a-near", at(0.1, 0), 89), pitch("beach", at(0.2, 5), 80)];
    expect(pickTopPitches(crowded, 3, undefined, spread).map((p) => p.id)).toEqual(["a", "beach"]);
  });
});
