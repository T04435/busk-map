import { describe, expect, it } from "vitest";
import { distanceM, distanceToLineM, geohashEncode, inBBox, round, wktPoint, wktPolygon } from "@/lib/geo";

const flinders = { lat: -37.8183, lon: 144.9671 };
const southernCross = { lat: -37.8184, lon: 144.9525 };

describe("geo", () => {
  it("measures great-circle distance", () => {
    // About 1.28 km between the two stations.
    expect(distanceM(flinders, southernCross)).toBeGreaterThan(1250);
    expect(distanceM(flinders, southernCross)).toBeLessThan(1310);
    expect(distanceM(flinders, flinders)).toBe(0);
  });

  it("measures distance to a polyline", () => {
    const line = [
      { lat: -37.8, lon: 144.96 },
      { lat: -37.8, lon: 144.97 },
    ];
    const point = { lat: -37.801, lon: 144.965 };
    expect(distanceToLineM(point, line)).toBeCloseTo(111.2, 0);
    // Beyond the end of the segment: distance to the endpoint.
    expect(distanceToLineM({ lat: -37.8, lon: 144.98 }, line)).toBeCloseTo(distanceM({ lat: -37.8, lon: 144.98 }, line[1]), 0);
    expect(distanceToLineM(point, [])).toBe(Number.POSITIVE_INFINITY);
    expect(distanceToLineM(point, [line[0]])).toBe(distanceM(point, line[0]));
    // A degenerate segment.
    expect(distanceToLineM(point, [line[0], line[0]])).toBeCloseTo(distanceM(point, line[0]), 0);
  });

  it("encodes geohashes", () => {
    expect(geohashEncode({ lat: -37.8136, lon: 144.9631 }, 7)).toBe("r1r0fsn");
    expect(geohashEncode({ lat: 57.64911, lon: 10.40744 }, 11)).toBe("u4pruydqqvj");
    expect(geohashEncode({ lat: 0, lon: 0 })).toHaveLength(9);
  });

  it("builds WKT with longitude first", () => {
    expect(wktPoint({ lat: -37.81361234, lon: 144.96311111 })).toBe("POINT(144.963111 -37.813612)");
    expect(wktPolygon({ south: -1, west: 2, north: 3, east: 4 })).toBe("POLYGON((2 -1, 4 -1, 4 3, 2 3, 2 -1))");
  });

  it("tests bounding boxes and rounds", () => {
    const box = { south: -38, west: 144, north: -37, east: 145 };
    expect(inBBox(flinders, box)).toBe(true);
    expect(inBBox({ lat: 0, lon: 0 }, box)).toBe(false);
    expect(round(1.23456, 2)).toBe(1.23);
  });
});
