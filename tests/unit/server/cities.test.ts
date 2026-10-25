import { describe, expect, it } from "vitest";
import { cityFromPlace, MELBOURNE } from "@/lib/city";
import { cityOf, hotspotsFor, knownCity, pitchesFor, rulesFor, spotifyMarket } from "@/server/cities";
import { PUBLIC_SPOTS, USUAL_HOTSPOTS } from "@/server/data/spots";
import { buildCandidatesWithFunnel, GENERAL_RULES } from "@/server/scoring/candidates";
import { offlineEvents, TOKYO, toMockFrame, fromMockFrame } from "@/server/offline-city";

const TOKYO_PLACE = { name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo" };
const tokyo = cityFromPlace("tokyo-jp", TOKYO_PLACE);

describe("city providers", () => {
  it("keeps Melbourne's own data for Melbourne only", () => {
    expect(pitchesFor(MELBOURNE)).toBe(PUBLIC_SPOTS);
    expect(hotspotsFor(MELBOURNE)).toBe(USUAL_HOTSPOTS);
    expect(rulesFor(MELBOURNE)).toEqual({ level: "local", url: "https://www.melbourne.vic.gov.au/busking", general: GENERAL_RULES });
    expect(pitchesFor(tokyo)).toEqual([]);
    expect(hotspotsFor(tokyo)).toEqual([]);
    expect(rulesFor(tokyo)).toMatchObject({ level: "none", url: null });
  });

  it("resolves a request's city, and the built-in city for the Repertoire's", () => {
    expect(cityOf({ city: "melbourne" })).toBe(MELBOURNE);
    expect(cityOf({ city: "tokyo-jp", place: TOKYO_PLACE })).toEqual(tokyo);
    expect(() => cityOf({ city: "tokyo-jp" })).toThrow();
    expect(knownCity("melbourne")).toBe(MELBOURNE);
    expect(knownCity("anything")).toBe(MELBOURNE);
  });

  it("looks songs up in the city's Spotify market, or Melbourne's where Spotify has none", () => {
    expect(spotifyMarket(MELBOURNE)).toBe("AU");
    expect(spotifyMarket(tokyo)).toBe("JP");
    expect(spotifyMarket({ countryCode: "CN" })).toBe("AU");
  });
});

describe("candidates in a city with no walkable spots", () => {
  const cells = [
    { lat: 35.69, lon: 139.69, affinity: 1, geohash: "xn774c0" },
    { lat: 35.695, lon: 139.7, affinity: 0.8, geohash: "xn774c9" },
    { lat: 35.68, lon: 139.68, affinity: 0.5, geohash: "xn76gzz" },
  ];

  it("stands a pitch at each top taste cell, named after a nearby Qloo place, with the city's rules line", () => {
    const rules = rulesFor(tokyo).general;
    const { candidates, funnel } = buildCandidatesWithFunnel({ sites: [], zones: [], spots: [], hotspots: [], cells, permit: "general", generalRules: rules, cellNames: [{ name: "Synthetic Bar 1", lat: 35.6901, lon: 139.6902 }] });
    expect(candidates.map((c) => c.name)).toEqual(["Near Synthetic Bar 1", "Taste area 2", "Taste area 3"]);
    expect(candidates[0]).toMatchObject({ id: "cell:xn774c0", origin: "taste", kind: "public-space", rules, cell: { rank: 1 } });
    expect(funnel).toMatchObject({ cells: 3, topCells: 3, candidates: 3 });
  });

  it("changes nothing for a city with spots (Melbourne)", () => {
    const melbourneCells = [{ lat: -37.8137, lon: 144.9645, affinity: 1 }];
    const { candidates } = buildCandidatesWithFunnel({ sites: [], zones: [], spots: PUBLIC_SPOTS, hotspots: USUAL_HOTSPOTS, cells: melbourneCells, permit: "general", cellNames: [] });
    expect(candidates.every((c) => !c.id.startsWith("cell:"))).toBe(true);
    expect(candidates[0].rules).toBe(GENERAL_RULES);
  });
});

describe("offline second city", () => {
  it("maps Tokyo onto Melbourne's synthetic field and back", () => {
    const point = { lat: 35.69, lon: 139.7 };
    const there = toMockFrame(point);
    expect(Math.abs(there.lat - MELBOURNE.center.lat)).toBeLessThan(0.05);
    const back = fromMockFrame(there, TOKYO);
    expect(back.lat).toBeCloseTo(point.lat, 6);
    expect(back.lon).toBeCloseTo(point.lon, 6);
    expect(toMockFrame(MELBOURNE.center)).toEqual(MELBOURNE.center);
  });

  it("moves the synthetic events to the plan's city", () => {
    const events = [{ id: "e", venue: { name: "V", lat: MELBOURNE.center.lat, lon: MELBOURNE.center.lon } }];
    expect(offlineEvents(events, MELBOURNE)).toBe(events);
    expect(offlineEvents(events, TOKYO)[0].venue).toMatchObject({ name: "V", lat: TOKYO.center.lat, lon: TOKYO.center.lon });
  });
});
