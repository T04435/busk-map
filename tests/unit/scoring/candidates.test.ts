import { describe, expect, it } from "vitest";
import { buildCandidates, nearLines, siteAllowsPerformer } from "@/server/scoring";
import type { SensorInput, SiteInput, ZoneInput } from "@/server/scoring";

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

  it("keeps only sites open to the performer, with cautions", () => {
    const sites = [
      site({ id: "gen", permit: "general", lat: -37.815, lon: 144.96 }),
      site({ id: "circle", permit: "circle-act", lat: -37.816, lon: 144.97 }),
      site({ id: "chess", permit: "chess-board", lat: -37.817, lon: 144.98 }),
      site({ id: "prem", permit: "premium", lat: -37.818, lon: 144.99 }),
      site({ id: "blocked", permit: "general", lat: -37.8, lon: 144.9505 }),
      site({ id: "quiet", permit: "general", lat: -37.8201, lon: 144.9705 }),
      site({ id: "private", permit: "private", lat: -37.83, lon: 144.96 }),
    ];
    const general = buildCandidates(sites, zones, [], "general");
    expect(general.map((c) => c.id)).toEqual(["site:gen", "site:circle", "site:chess", "site:quiet"]);
    expect(general.every((c) => c.kind === "designated")).toBe(true);
    expect(general[0].cautions).toEqual([]);
    expect(general[1].cautions).toEqual(["Circle act permit holders have priority here."]);
    expect(general[2].cautions[0]).toMatch(/Special conditions/);
    expect(general[3]).toMatchObject({ amplification: "unamplified-zone", cautions: ["Unamplified busking only."] });

    const premium = buildCandidates(sites, zones, [], "premium");
    expect(premium.map((c) => c.id)).toContain("site:prem");
    expect(premium.find((c) => c.id === "site:prem")!.cautions).toEqual(["Premium permit holders only."]);

    const circle = buildCandidates(sites, zones, [], "circle-act");
    expect(circle.find((c) => c.id === "site:circle")!.cautions).toEqual([]);
  });

  it("adds footpath candidates at sensors, away from restrictions and from each other", () => {
    const sites = [site({ id: "station", permit: "no-busking", lat: -37.81, lon: 144.96 }), site({ id: "gen", permit: "general", lat: -37.83, lon: 144.96 })];
    const sensors = [
      sensor(1, -37.8102, 144.9601), // next to the no-busking site
      sensor(2, -37.8, 144.9505), // on a no-busking line
      sensor(3, -37.815, 144.965), // fine
      sensor(4, -37.8151, 144.9651), // too close to sensor 3
      sensor(5, -37.83, 144.9601), // too close to the designated site
      sensor(6, -37.8201, 144.9705), // in the unamplified zone
    ];
    const result = buildCandidates(sites, zones, sensors, "general");
    const footpaths = result.filter((c) => c.kind === "footpath");
    expect(footpaths.map((c) => c.id)).toEqual(["footpath:3", "footpath:6"]);
    expect(footpaths[0]).toMatchObject({ name: "Footpath near Sensor 3", permit: "general", amplification: "allowed" });
    expect(footpaths[0].cautions[0]).toMatch(/clearances/);
    expect(footpaths[1].amplification).toBe("unamplified-zone");

    expect(buildCandidates(sites, zones, sensors, "general", { includeFootpaths: false }).every((c) => c.kind === "designated")).toBe(true);
  });
});
