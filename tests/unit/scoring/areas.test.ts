import { describe, expect, it } from "vitest";
import { boxAround } from "@/lib/city";
import { distanceM } from "@/lib/geo";
import {
  AREA_MIN_SEPARATION_KM,
  DISTRICT_MIN_SEPARATION_KM,
  districtsFromAreas,
  MAX_AREAS,
  MAX_DISTRICTS,
  pickAreas,
  rankAreas,
  type NamedArea,
} from "@/server/scoring";

/** Named areas around an invented metro centre: points are offsets in km (north, east). */
const CENTER = { lat: 25.77, lon: -80.19 };
const KM_LAT = 1 / 111.32;
const KM_LON = 1 / (111.32 * Math.cos((CENTER.lat * Math.PI) / 180));
const at = (n: number, e: number) => ({ lat: CENTER.lat + n * KM_LAT, lon: CENTER.lon + e * KM_LON });
const CITY = { name: "Metro", center: CENTER, bbox: boxAround(CENTER, 15, 15) };
const area = (name: string, kind: NamedArea["kind"], n: number, e: number, population: number | null = null): NamedArea => ({ name, kind, population, ...at(n, e) });
const cell = (n: number, e: number, affinity: number, popularity: number | null = null) => ({ ...at(n, e), affinity, popularity });

describe("pickAreas: the areas a metro compares", () => {
  it("keeps the city first, then towns and suburbs before neighbourhoods, larger populations first", () => {
    const picked = pickAreas(
      [area("Little Quarter", "neighbourhood", 4, 0), area("Beach Town", "town", 0, 6, 80_000), area("Big Suburb", "suburb", -5, 0, 120_000), area("Old Village", "village", 0, -6)],
      CITY,
    );
    expect(picked.map((a) => a.name)).toEqual(["Metro", "Big Suburb", "Beach Town", "Old Village", "Little Quarter"]);
    expect(picked[0]).toMatchObject({ kind: "city", lat: CENTER.lat, lon: CENTER.lon });
  });

  it("drops an area within 1.5 km of one kept, or with the same name, and anything outside the planning area", () => {
    const picked = pickAreas(
      [
        area("Downtown", "neighbourhood", 0.8, 0),
        area("Gables", "town", -8, -4, 50_000),
        area("Gables Estates", "neighbourhood", -8.6, -4.5),
        area("gables", "suburb", -3, 8),
        area("Far Away", "town", 30, 0, 1_000_000),
      ],
      CITY,
    );
    expect(picked.map((a) => a.name)).toEqual(["Metro", "Gables"]);
    for (const [i, a] of picked.entries()) for (const b of picked.slice(i + 1)) expect(distanceM(a, b)).toBeGreaterThanOrEqual(AREA_MIN_SEPARATION_KM * 1000);
  });

  it("caps the list at about ten, the city included", () => {
    const grid = Array.from({ length: 40 }, (_, i) => area(`Suburb ${i}`, "suburb", -12 + Math.floor(i / 7) * 4, -12 + (i % 7) * 4));
    expect(pickAreas(grid, CITY)).toHaveLength(MAX_AREAS);
    expect(pickAreas(grid, CITY, { max: 4 })).toHaveLength(4);
    expect(pickAreas([], CITY).map((a) => a.name)).toEqual(["Metro"]);
  });
});

describe("rankAreas: taste and activity from the one coarse heatmap", () => {
  it("scores each area from the coarse cells near it, best first, with its share of the best", () => {
    const areas = [area("Metro", "city", 0, 0), area("Beach", "town", 0, 6), area("Gables", "town", -8, -4), area("Quiet", "suburb", 10, -10)];
    const cells = [cell(0.3, 0.2, 0.6, 0.9), cell(0, 6.4, 0.9, 0.5), cell(0, 5.5, 0.4), cell(-8, -4, 0.45, 0.3), cell(5, 5, 1)];
    const ranked = rankAreas(areas, cells);
    expect(ranked.map((a) => [a.name, a.rank, a.share])).toEqual([
      ["Beach", 1, 1],
      ["Metro", 2, 0.67],
      ["Gables", 3, 0.5],
      ["Quiet", 4, 0],
    ]);
    expect(ranked[0]).toMatchObject({ taste: 0.9, activity: 0.5, cells: 2 });
    expect(ranked[3]).toMatchObject({ taste: 0, activity: null, cells: 0 });
  });

  it("breaks a taste tie on activity", () => {
    const ranked = rankAreas([area("A", "town", 0, -5), area("B", "town", 0, 5)], [cell(0, -5, 0.5, 0.2), cell(0, 5, 0.5, 0.8)]);
    expect(ranked.map((a) => a.name)).toEqual(["B", "A"]);
  });
});

describe("districtsFromAreas: the areas the plan zooms into", () => {
  it("takes the best areas with taste, at least 2.5 km apart, at most 4, keeping their names", () => {
    const areas = [area("Metro", "city", 0, 0), area("Brickell", "suburb", -2, 0), area("Beach", "town", 0, 6), area("Gables", "town", -8, -4), area("North", "town", 9, 0), area("Grove", "suburb", -6, 3), area("Quiet", "suburb", 10, -10)];
    const cells = [cell(0, 0, 1), cell(-2, 0, 0.95), cell(0, 6, 0.9), cell(-8, -4, 0.8), cell(9, 0, 0.7), cell(-6, 3, 0.6)];
    const districts = districtsFromAreas(rankAreas(areas, cells), CITY.bbox);
    expect(districts.map((d) => d.name)).toEqual(["Metro", "Beach", "Gables", "North"]);
    expect(districts).toHaveLength(MAX_DISTRICTS);
    expect(districts.map((d) => d.id)).toEqual(["d1", "d2", "d3", "d4"]);
    for (const d of districts) {
      expect(d.area).toBe(true);
      expect(d.bbox.south).toBeLessThan(d.center.lat);
      expect(d.bbox.north).toBeGreaterThan(d.center.lat);
    }
    for (const [i, a] of districts.entries()) for (const b of districts.slice(i + 1)) expect(distanceM(a.center, b.center)).toBeGreaterThanOrEqual(DISTRICT_MIN_SEPARATION_KM * 1000);
    expect(districts[1].affinity).toBe(0.9);
  });

  it("is empty when no area has taste (the plan then falls back to the heatmap's peaks)", () => {
    expect(districtsFromAreas(rankAreas([area("Metro", "city", 0, 0), area("Beach", "town", 0, 6)], [cell(12, 12, 1)]), CITY.bbox)).toEqual([]);
    expect(districtsFromAreas([], CITY.bbox)).toEqual([]);
  });

  it("breaks a full tie by name", () => {
    expect(rankAreas([area("Bravo", "suburb", 0, 0), area("Alpha", "suburb", 5, 5)], []).map((a) => a.name)).toEqual(["Alpha", "Bravo"]);
  });
});
