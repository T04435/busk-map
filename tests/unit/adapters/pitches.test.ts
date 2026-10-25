import { MELBOURNE } from "@/lib/city";
import { describe, expect, it } from "vitest";
import { getPitches, PITCHES_FALLBACK } from "@/server/adapters/pitches";
import { SYNTHETIC_RAW } from "@/server/adapters/pitches/fixtures/synthetic";
import { parseFlag, parsePermit, parseRules, webMercatorToLatLon } from "@/server/adapters/pitches/parse";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

describe("pitches parsing", () => {
  it("converts Web Mercator to WGS84", () => {
    const { lat, lon } = webMercatorToLatLon(16134427, -4553043);
    // Docklands (Harbour Town).
    expect(lat).toBeCloseTo(-37.813, 2);
    expect(lon).toBeCloseTo(144.937, 2);
  });

  it("maps permit types", () => {
    expect(parsePermit("Premium Permit Holder")).toBe("premium");
    expect(parsePermit("Non musical site for Premium Permit holders only")).toBe("premium");
    expect(parsePermit("No busking permitted")).toBe("no-busking");
    expect(parsePermit("Circle Act")).toBe("circle-act");
    expect(parsePermit("Chess Board (see special conditions)")).toBe("chess-board");
    expect(parsePermit("Pavement Art")).toBe("pavement-art");
    expect(parsePermit("Privately Managed")).toBe("private");
    expect(parsePermit(" ")).toBe("general");
    expect(parsePermit(null)).toBe("general");
    expect(parsePermit("Something new")).toBe("unknown");
  });

  it("maps Y/N flags and strips HTML from rules", () => {
    expect(parseFlag("Y")).toBe(true);
    expect(parseFlag(" n ")).toBe(false);
    expect(parseFlag(" ")).toBeNull();
    expect(parseFlag(undefined)).toBeNull();
    expect(parseRules("<a href='https://example.com/x'>Contact</a>  directly.")).toEqual({
      rules: "Contact directly.",
      rulesUrl: "https://example.com/x",
    });
    expect(parseRules("<a href='javascript:alert(1)'>x</a>").rulesUrl).toBeNull();
    expect(parseRules(null)).toEqual({ rules: "", rulesUrl: null });
  });
});

describe("getPitches", () => {
  it("loads sites and both zone layers", async () => {
    const { calls } = mockFetch([
      route((u) => u.host === "www.arcgis.com", () => json(SYNTHETIC_RAW.points)),
      route((u) => u.pathname.includes("No_Busking_Permitted"), () => json(SYNTHETIC_RAW.noBusking)),
      route((u) => u.pathname.includes("Unamplified_Busking_Permitted"), () => json(SYNTHETIC_RAW.unamplified)),
    ]);
    const result = await getPitches(MELBOURNE, LIVE);
    expect(result.mode).toBe("live");
    expect(result.data.sites).toHaveLength(3);
    expect(result.data.sites[0]).toMatchObject({ id: "com-0", name: "Synthetic Mall", permit: "premium", buskingAllowed: true });
    expect(result.data.sites[1]).toMatchObject({ permit: "private", rulesUrl: "https://example.com/synthetic" });
    expect(result.data.sites[2]).toMatchObject({ name: "Busking site 2", permit: "general", musicAllowed: false });
    expect(result.data.zones.map((z) => z.id)).toEqual(["unamplified-1", "no-busking-1"]);
    expect(result.data.zones[0].lines).toHaveLength(2);
    expect(result.data.zones[1].lines[0][0]).toEqual({ lat: -37.8136, lon: 144.957 });
    const zoneCall = calls.find((c) => c.url.pathname.includes("No_Busking"))!;
    expect(zoneCall.url.searchParams.get("outSR")).toBe("4326");
  });

  it("falls back when any layer fails", async () => {
    mockFetch([
      route((u) => u.host === "www.arcgis.com", () => json(SYNTHETIC_RAW.points)),
      route(() => true, () => json({ error: "nope" }, 500)),
    ]);
    const result = await getPitches(MELBOURNE, LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "http", data: PITCHES_FALLBACK });
  });

  it("serves synthetic data offline", async () => {
    const result = await getPitches(MELBOURNE, OFFLINE);
    expect(result.mode).toBe("synthetic");
    expect(result.data.sites.length).toBeGreaterThan(0);
  });
});
