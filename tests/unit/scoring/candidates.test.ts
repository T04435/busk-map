import { describe, expect, it } from "vitest";
import { buildCandidates, buildCandidatesWithFunnel, nearLines, siteAllowsPerformer, topCells, usualSpotAt } from "@/server/scoring";
import type { HeatCellInput, HotspotInput, SensorInput, SiteInput, SpotInput, ZoneInput } from "@/server/scoring";
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

const sensor = (id: number, lat: number, lon: number): SensorInput => ({ id, name: `Sensor ${id}`, lat, lon, avgHourly: 100 });

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
  const base = { zones, sensors: [] as SensorInput[], spots: [] as SpotInput[], cells: [] as HeatCellInput[], hotspots: [] as HotspotInput[] };

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

  it("snaps the performer's top taste cells to nearby public spots and sensors, then applies the rules", () => {
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
    const sensors = [sensor(3, -37.8135, 144.9605), sensor(9, -37.79, 144.99)];
    const hotspots: HotspotInput[] = [{ name: "The famous corner", lat: -37.8201, lon: 144.9704 }];
    const { candidates, funnel } = buildCandidatesWithFunnel({ sites, zones, sensors, spots, cells, hotspots, permit: "general" });
    expect(candidates.map((c) => c.id)).toEqual(["spot:plaza", "footpath:3", "spot:riverside", "footpath:9"]);
    expect(candidates[0]).toMatchObject({ kind: "public-space", origin: "taste", cell: { rank: 1, affinity: 1 }, usualSpot: null, permit: "general" });
    expect(candidates[0].cautions[0]).toMatch(/clearances/);
    expect(candidates[1]).toMatchObject({ kind: "footpath", name: "Footpath near Sensor 3" });
    expect(candidates[2]).toMatchObject({ amplification: "unamplified-zone", usualSpot: "The famous corner", cell: { rank: 2 } });
    // Four top cells (the minimum), so the weak cell near sensor 9 counts too. The plaza twin is too close to the plaza.
    expect(funnel).toEqual({ cells: 5, topCells: 4, considered: 6, excluded: 1, candidates: 4 });
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
    const { candidates, funnel } = buildCandidatesWithFunnel({ sites, zones, sensors: [], spots, cells, hotspots, permit: "general" });
    expect(candidates.map((c) => [c.id, c.origin, c.usualSpot])).toEqual([
      ["spot:far-taste", "taste", null],
      ["spot:mall", "hotspot", "The Mall"],
      ["hotspot:wharf-corner", "hotspot", "Wharf corner"],
    ]);
    expect(funnel).toMatchObject({ excluded: 1, candidates: 3 });
    // With no taste data too.
    const fallback = buildCandidates({ sites, zones, sensors: [], spots: [], cells: [], hotspots, permit: "general" });
    expect(fallback.map((c) => c.id)).toEqual(["hotspot:the-mall", "hotspot:wharf-corner"]);
  });

  it("the real hotspot list includes the usual circuit, and each hotspot names the nearest one", () => {
    const names = USUAL_HOTSPOTS.map((h) => h.name);
    expect(names).toEqual(expect.arrayContaining(["Federation Wharf", "Degraves Street", "Flinders Street Station", "Flinders St / Elizabeth St corner", "Bourke Street Mall", "Federation Square"]));
    // Federation Wharf is within Federation Square's radius, but is its own hotspot.
    for (const h of USUAL_HOTSPOTS) expect(usualSpotAt(h, USUAL_HOTSPOTS)).toBe(h.name);
  });

  it("falls back to every spot and sensor when there is no taste data", () => {
    const spots: SpotInput[] = [{ id: "a", name: "A", kind: "square", lat: -37.81, lon: 144.96 }];
    const { candidates, funnel } = buildCandidatesWithFunnel({ ...base, sites: [], spots, sensors: [sensor(1, -37.83, 144.96)], permit: "general" });
    expect(candidates.map((c) => [c.id, c.origin])).toEqual([["spot:a", "fallback"], ["footpath:1", "fallback"]]);
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
      buildCandidatesWithFunnel({ zones: [], hotspots: [], sites: [], sensors: [], spots, cells: cells(geohash), permit: "general" }).candidates.map((c) => c.id);
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
