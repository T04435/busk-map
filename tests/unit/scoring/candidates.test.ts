import { describe, expect, it } from "vitest";
import { buildCandidates, buildCandidatesWithFunnel, CELL_NAME_RADIUS_M, NEAR_FALLBACK_RADIUS_M,
  TELL_APART_RADIUS_M, tasteSpotName, nearLines, siteAllowsPerformer, topCells, usualSpotAt } from "@/server/scoring";
import type { HeatCellInput, HotspotInput, SiteInput, SpotInput, ZoneInput } from "@/server/scoring";
import { USUAL_HOTSPOTS } from "@/server/data/spots";

const site = (over: Partial<SiteInput>): SiteInput => ({
  id: "s",
  name: "Site",
  lat: -37.81,
  lon: 144.96,
  permit: "general",
  musicAllowed: true,
  rules: "rules",
  rulesUrl: null,
  ...over,
});


describe("siteAllowsPerformer", () => {
  it("applies permit categories", () => {
    expect(siteAllowsPerformer(site({ permit: "general" }), "general")).toBe(true);
    expect(siteAllowsPerformer(site({ permit: "chess-board" }), "general")).toBe(true);
    expect(siteAllowsPerformer(site({ permit: "circle-act" }), "general")).toBe(true);
    expect(siteAllowsPerformer(site({ permit: "premium" }), "general")).toBe(false);
    expect(siteAllowsPerformer(site({ permit: "premium" }), "premium")).toBe(true);
    expect(siteAllowsPerformer(site({ permit: "private" }), "premium")).toBe(false);
    expect(siteAllowsPerformer(site({ permit: "no-busking" }), "general")).toBe(false);
    expect(siteAllowsPerformer(site({ permit: "general", musicAllowed: false }), "general")).toBe(false);
    expect(siteAllowsPerformer(site({ permit: "general", musicAllowed: null }), "general")).toBe(true);
  });
});

describe("nearLines", () => {
  const zones: ZoneInput[] = [{ id: "z", kind: "no-busking", lines: [[{ lat: -37.81, lon: 144.96 }, { lat: -37.81, lon: 144.97 }]] }];
  it("matches only the requested zone kind within the buffer", () => {
    expect(nearLines({ lat: -37.8101, lon: 144.965 }, zones, "no-busking", 30)).toBe(true);
    expect(nearLines({ lat: -37.8101, lon: 144.965 }, zones, "unamplified", 30)).toBe(false);
    expect(nearLines({ lat: -37.812, lon: 144.965 }, zones, "no-busking", 30)).toBe(false);
  });
});

describe("buildCandidates", () => {
  const zones: ZoneInput[] = [
    { id: "nb", kind: "no-busking", lines: [[{ lat: -37.8, lon: 144.95 }, { lat: -37.8, lon: 144.951 }]] },
    { id: "ua", kind: "unamplified", lines: [[{ lat: -37.82, lon: 144.97 }, { lat: -37.82, lon: 144.971 }]] },
  ];
  const base = { zones, spots: [] as SpotInput[], cells: [] as HeatCellInput[], hotspots: [] as HotspotInput[] };

  it("keeps only council sites open to the performer, with cautions", () => {
    const sites = [
      site({ id: "gen", permit: "general", lat: -37.815, lon: 144.96 }),
      site({ id: "circle", permit: "circle-act", lat: -37.816, lon: 144.97 }),
      site({ id: "chess", permit: "chess-board", lat: -37.817, lon: 144.98 }),
      site({ id: "prem", permit: "premium", lat: -37.818, lon: 144.99 }),
      site({ id: "blocked", permit: "general", lat: -37.8, lon: 144.9505 }),
      site({ id: "quiet", permit: "general", lat: -37.8201, lon: 144.9705 }),
      site({ id: "private", permit: "private", lat: -37.83, lon: 144.96 }),
    ];
    const general = buildCandidates({ ...base, sites, permit: "general" });
    expect(general.map((c) => c.id)).toEqual(["site:gen", "site:circle", "site:chess", "site:quiet"]);
    expect(general.every((c) => c.kind === "designated" && c.origin === "council" && c.cell === null)).toBe(true);
    expect(general[0].cautions).toEqual([]);
    expect(general[1].cautions).toEqual(["Circle act permit holders have priority here."]);
    expect(general[2].cautions[0]).toMatch(/Special conditions/);
    expect(general[3]).toMatchObject({ amplification: "unamplified-zone", cautions: ["Unamplified busking only."] });

    const premium = buildCandidates({ ...base, sites, permit: "premium" });
    expect(premium.find((c) => c.id === "site:prem")!.cautions).toEqual(["Premium permit holders only."]);
    expect(buildCandidates({ ...base, sites, permit: "circle-act" }).find((c) => c.id === "site:circle")!.cautions).toEqual([]);
  });

  it("snaps the performer's top taste cells to nearby public spots, then applies the rules", () => {
    const sites = [site({ id: "station", permit: "no-busking", lat: -37.81, lon: 144.96 })];
    const cells: HeatCellInput[] = [
      { lat: -37.81, lon: 144.96, affinity: 1 },
      { lat: -37.82, lon: 144.97, affinity: 0.9 },
      { lat: -37.79, lon: 144.99, affinity: 0.1 },
      { lat: -37.78, lon: 144.99, affinity: 0.05 },
      { lat: -37.77, lon: 144.99, affinity: 0 },
    ];
    const spots: SpotInput[] = [
      { id: "next-to-station", name: "Next to the station", kind: "square", lat: -37.8102, lon: 144.9601 },
      { id: "plaza", name: "Plaza", kind: "square", lat: -37.812, lon: 144.962 },
      { id: "plaza-twin", name: "Plaza twin", kind: "square", lat: -37.8121, lon: 144.9621 },
      { id: "riverside", name: "Riverside", kind: "promenade", lat: -37.8201, lon: 144.9705 },
      { id: "far", name: "Far away", kind: "square", lat: -37.85, lon: 144.9 },
    ];
    const hotspots: HotspotInput[] = [{ name: "The famous corner", lat: -37.8201, lon: 144.9704 }];
    const { candidates, funnel } = buildCandidatesWithFunnel({ sites, zones, spots, cells, hotspots, permit: "general" });
    expect(candidates.map((c) => c.id)).toEqual(["spot:plaza", "spot:riverside"]);
    expect(candidates[0]).toMatchObject({ kind: "public-space", origin: "taste", cell: { rank: 1, affinity: 1 }, usualSpot: null, permit: "general" });
    expect(candidates[0].cautions[0]).toMatch(/clearances/);
    expect(candidates[1]).toMatchObject({ amplification: "unamplified-zone", usualSpot: "The famous corner", cell: { rank: 2 } });
    // Four top cells (the minimum). The plaza twin is too close to the plaza.
    expect(funnel).toEqual({ cells: 5, topCells: 4, considered: 4, excluded: 1, candidates: 2 });
    expect(candidates.map((c) => c.id)).not.toContain("spot:far");
  });

  it("adds every well-known hotspot to the list, through the same legality filter; the score decides", () => {
    const sites = [site({ id: "restricted", permit: "no-busking", lat: -37.83, lon: 144.95 })];
    const cells: HeatCellInput[] = [1, 0.9, 0.8, 0.7].map((affinity, i) => ({ lat: -37.80 - i * 0.001, lon: 144.99, affinity }));
    const spots: SpotInput[] = [
      { id: "far-taste", name: "Taste square", kind: "square", lat: -37.8001, lon: 144.9901 },
      { id: "mall", name: "The Mall", kind: "pedestrian-street", lat: -37.8137, lon: 144.9645 },
    ];
    const hotspots: HotspotInput[] = [
      // At a public spot: the spot's own id, so links and caches line up.
      { name: "The Mall", lat: -37.81372, lon: 144.96454 },
      // No spot there: its own candidate.
      { name: "Wharf corner", lat: -37.8188, lon: 144.9693 },
      // Ruled out by a restricted site: dropped like any other candidate.
      { name: "Banned plaza", lat: -37.8301, lon: 144.9501 },
    ];
    const { candidates, funnel } = buildCandidatesWithFunnel({ sites, zones, spots, cells, hotspots, permit: "general" });
    expect(candidates.map((c) => [c.id, c.origin, c.usualSpot])).toEqual([
      ["spot:far-taste", "taste", null],
      ["spot:mall", "hotspot", "The Mall"],
      ["hotspot:wharf-corner", "hotspot", "Wharf corner"],
    ]);
    expect(funnel).toMatchObject({ excluded: 1, candidates: 3 });
    // With no taste data too.
    const fallback = buildCandidates({ sites, zones, spots: [], cells: [], hotspots, permit: "general" });
    expect(fallback.map((c) => c.id)).toEqual(["hotspot:the-mall", "hotspot:wharf-corner"]);
  });

  it("the real hotspot list includes the usual circuit, and each hotspot names the nearest one", () => {
    const names = USUAL_HOTSPOTS.map((h) => h.name);
    expect(names).toEqual(expect.arrayContaining(["Federation Wharf", "Degraves Street", "Flinders Street Station", "Flinders St / Elizabeth St corner", "Bourke Street Mall", "Federation Square"]));
    // Federation Wharf is within Federation Square's radius, but is its own hotspot.
    for (const h of USUAL_HOTSPOTS) expect(usualSpotAt(h, USUAL_HOTSPOTS)).toBe(h.name);
  });

  it("falls back to every spot when there is no taste data", () => {
    const spots: SpotInput[] = [{ id: "a", name: "A", kind: "square", lat: -37.81, lon: 144.96 }];
    const { candidates, funnel } = buildCandidatesWithFunnel({ ...base, sites: [], spots, permit: "general" });
    expect(candidates.map((c) => [c.id, c.origin])).toEqual([["spot:a", "fallback"]]);
    expect(funnel.topCells).toBe(0);
  });
});

describe("fine-grained heatmaps", () => {
  it("snap spots to a geohash-7 cell over a tighter radius", () => {
    const spots: SpotInput[] = [
      { id: "near", name: "Near", kind: "square", lat: -37.8118, lon: 144.96 },
      { id: "mid", name: "Mid", kind: "square", lat: -37.8135, lon: 144.96 },
    ];
    const cells = (geohash: string) => [0.9, 0.1, 0.2, 0.3].map((affinity, i) => ({ lat: -37.81 - i * 0.05, lon: 144.96, affinity, geohash }));
    const ids = (geohash: string) =>
      buildCandidatesWithFunnel({ zones: [], hotspots: [], sites: [], spots, cells: cells(geohash), permit: "general" }).candidates.map((c) => c.id);
    // "Mid" is about 390 m from the best cell: inside the geohash-6 snap radius, outside the geohash-7 one.
    expect(ids("r1r0fs")).toEqual(["spot:near", "spot:mid"]);
    expect(ids("r1r0fs1")).toEqual(["spot:near"]);
  });
});

describe("topCells and usualSpotAt", () => {
  it("takes the best share of cells, at least four, ranked", () => {
    const cells = Array.from({ length: 20 }, (_, i) => ({ lat: -37.8 - i * 0.001, lon: 144.96, affinity: i / 20 }));
    const top = topCells(cells);
    expect(top).toHaveLength(6);
    expect(top[0]).toMatchObject({ affinity: 0.95, rank: 1 });
    expect(topCells(cells.slice(0, 2))).toHaveLength(2);
    // Ties break by position, so the order is stable.
    const tied = [{ lat: -37.8, lon: 144.97, affinity: 1 }, { lat: -37.8, lon: 144.96, affinity: 1 }, { lat: -37.81, lon: 144.99, affinity: 1 }];
    expect(topCells(tied).map((c) => [c.lat, c.lon])).toEqual([[-37.81, 144.99], [-37.8, 144.96], [-37.8, 144.97]]);
  });

  it("names the hotspot a point is at", () => {
    const hotspots = [{ name: "Corner", lat: -37.81, lon: 144.96 }];
    expect(usualSpotAt({ lat: -37.8101, lon: 144.9601 }, hotspots)).toBe("Corner");
    expect(usualSpotAt({ lat: -37.82, lon: 144.96 }, hotspots)).toBeNull();
    expect(usualSpotAt({ lat: -37.8125, lon: 144.96 }, [{ name: "Market", lat: -37.81, lon: 144.96, radiusM: 300 }])).toBe("Market");
  });
});

describe("taste spot names (tasteSpotName)", () => {
  // A Lisbon-like layout: two named areas 2 km apart, a venue 10 m and one 300 m from the point, one 600 m away.
  const point = { lat: 38.71, lon: -9.14 };
  const areas = [
    { name: "Baixa", lat: 38.711, lon: -9.139 },
    { name: "Belém", lat: 38.697, lon: -9.206 },
  ];
  const venues = [
    { name: "Café Nicola", lat: 38.7109, lon: -9.14 },
    { name: "Bar Rossio", lat: 38.7127, lon: -9.14 },
    { name: "Too Far Club", lat: 38.7154, lon: -9.14 },
  ];

  it("names a spot by its area and the nearest venue", () => {
    expect(tasteSpotName(point, { areas, venues, city: "Lisbon" })).toBe("Baixa · near Café Nicola");
  });

  it("takes the nearest named area even beyond its reach, unless the city's centre is nearer", () => {
    expect(tasteSpotName(point, { areas: [areas[1]], venues, city: "Lisbon" })).toBe("Belém · near Café Nicola");
    expect(tasteSpotName(point, { areas: [areas[1]], venues: [], city: "Lisbon" })).toBe("Belém taste spot");
    expect(tasteSpotName(point, { areas: [areas[1]], venues, city: "Lisbon", cityCenter: { lat: 38.7105, lon: -9.141 } })).toBe("Lisbon · near Café Nicola");
  });

  it("names a spot by its venue alone in a city with no named areas", () => {
    expect(tasteSpotName(point, { areas: [], venues, city: "Lisbon" })).toBe("Near Café Nicola");
  });

  it("names by the nearest venue within CELL_NAME_RADIUS_M, else the nearest real place within NEAR_FALLBACK_RADIUS_M, before a taste spot", () => {
    expect(CELL_NAME_RADIUS_M).toBeGreaterThanOrEqual(400);
    expect(NEAR_FALLBACK_RADIUS_M).toBe(1500);
    expect(tasteSpotName(point, { venues: [venues[1]] })).toBe("Near Bar Rossio");
    // 600 m off: still a real name, never "Lisbon taste spot".
    expect(tasteSpotName(point, { venues: [venues[2]], city: "Lisbon" })).toBe("Near Too Far Club");
    expect(tasteSpotName(point, { streets: [{ name: "Rua Augusta", lat: 38.7195, lon: -9.14 }], city: "Lisbon" })).toBe("Near Rua Augusta");
    // Beyond 1.5 km nothing names it.
    expect(tasteSpotName(point, { venues: [{ name: "Way Off", lat: 38.73, lon: -9.14 }], city: "Lisbon" })).toBe("Lisbon taste spot");
  });

  it("names a spot by its area alone when no venue is near", () => {
    expect(tasteSpotName(point, { areas, venues: [], city: "Lisbon" })).toBe("Baixa taste spot");
  });

  it("falls back to the city, then to a plain taste spot, never a number", () => {
    expect(tasteSpotName(point, { city: "Lisbon" })).toBe("Lisbon taste spot");
    expect(tasteSpotName(point, {})).toBe("Taste spot");
  });

  it("tells two spots apart by the next-nearest venue, a street or place within 1.5 km, another area with those places, else drops the spot: never coordinates, a compass hint, a distance or an ordinal", () => {
    const taken = new Set(["Baixa · near Café Nicola"]);
    expect(tasteSpotName(point, { areas, venues, city: "Lisbon" }, taken)).toBe("Baixa · near Bar Rossio");
    taken.add("Baixa · near Bar Rossio");
    expect(TELL_APART_RADIUS_M).toBe(800);
    expect(tasteSpotName(point, { areas, venues, city: "Lisbon" }, taken)).toBe("Baixa · near Too Far Club");
    taken.add("Baixa · near Too Far Club");
    const streets = [{ name: "Rua Augusta", lat: 38.7095, lon: -9.1395 }, { name: "Rua Longe", lat: 38.72, lon: -9.14 }, { name: "Rua Distante", lat: 38.73, lon: -9.14 }];
    expect(tasteSpotName(point, { areas, venues, streets, city: "Lisbon" }, taken)).toBe("Baixa · near Rua Augusta");
    taken.add("Baixa · near Rua Augusta");
    // Rua Longe is 1.1 km off: still a real name.
    expect(tasteSpotName(point, { areas, venues, streets, city: "Lisbon" }, taken)).toBe("Baixa · near Rua Longe");
    taken.add("Baixa · near Rua Longe");
    // Every place near Baixa taken: the next area (Belém) pairs with them.
    expect(tasteSpotName(point, { areas, venues, streets, city: "Lisbon" }, taken)).toBe("Belém · near Rua Augusta");
    // An area named like the place itself reads as the place alone.
    expect(tasteSpotName(point, { areas: [areas[0], { name: "Bar Rossio", lat: 38.72, lon: -9.14 }], venues: [venues[1]], city: "Lisbon" }, new Set(["Baixa · near Bar Rossio"]))).toBe("Near Bar Rossio");
    // Nothing real left: no name at all (the caller drops the spot).
    const one = { venues: [venues[0]], city: "Lisbon" };
    expect(tasteSpotName(point, one, new Set(["Near Café Nicola"]))).toBeNull();
    expect(tasteSpotName(point, {}, new Set(["Taste spot"]))).toBeNull();
  });

  it("never names a candidate with coordinates, a compass hint, a distance or an ordinal: a spot it can't tell apart is dropped", () => {
    const cells = Array.from({ length: 12 }, (_, i) => ({ lat: 38.7 + (i % 4) * 0.004, lon: -9.14 + Math.floor(i / 4) * 0.004, affinity: 1 - i * 0.05, geohash: `c${i}` }));
    for (const naming of [{ cellNames: venues.slice(0, 1) }, { cellNames: venues, areas }, { cellNames: [] as typeof venues }, { cellNames: venues, streets: [{ name: "Rua Augusta", lat: 38.7095, lon: -9.1395 }] }]) {
      const { candidates } = buildCandidatesWithFunnel({ sites: [], zones: [], spots: [], hotspots: [], cells, permit: "general", city: "Lisbon", cityCenter: { lat: 38.71, lon: -9.14 }, ...naming });
      const names = candidates.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
      for (const n of names) expect(n).not.toMatch(/\d+\.\d{3,}|\(\d+\)|\b(north|south|east|west)\b|\d km/);
    }
  });

  it("names the cell pitches of a city with no spots, ids staying the cells' geohashes", () => {
    const cells = [
      { lat: 38.71, lon: -9.14, affinity: 1, geohash: "eycs0p1" },
      { lat: 38.7125, lon: -9.1415, affinity: 0.9, geohash: "eycs0p2" },
      { lat: 38.6975, lon: -9.205, affinity: 0.8, geohash: "eycs0p3" },
    ];
    const { candidates } = buildCandidatesWithFunnel({ sites: [], zones: [], spots: [], hotspots: [], cells, permit: "general", cellNames: venues, areas, city: "Lisbon" });
    expect(candidates.map((c) => [c.id, c.name])).toEqual([
      ["cell:eycs0p1", "Baixa · near Café Nicola"],
      ["cell:eycs0p2", "Baixa · near Bar Rossio"],
      ["cell:eycs0p3", "Belém taste spot"],
    ]);
  });

  it("has no area when the city's centre is nearer and the city is unnamed", () => {
    expect(tasteSpotName(point, { areas: [areas[1]], venues, cityCenter: { lat: 38.7105, lon: -9.141 } })).toBe("Near Café Nicola");
  });

  it("takes the alphabetically first of two venues equally near", () => {
    const spot = { lat: 38.7101, lon: -9.14 };
    expect(tasteSpotName(point, { venues: [{ name: "Zé Bar", ...spot }, { name: "Adega", ...spot }] })).toBe("Near Adega");
  });


});
