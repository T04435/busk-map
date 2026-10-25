import { afterEach, describe, expect, it, vi } from "vitest";
import { SYNTHETIC_GEOCODE } from "@/server/adapters/geocode/fixtures/synthetic";
import { json, mockFetch, route } from "../../helpers";

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("@/app/api/cities/route");
}

const ask = (q: string, headers: HeadersInit = {}) => new Request(`http://localhost/api/cities?q=${encodeURIComponent(q)}`, { headers });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/cities (Open-Meteo geocoding)", () => {
  it("asks the geocoder once and answers cities only, with slugs, regions and time zones", async () => {
    const { GET } = await load({ BUSKMAP_OFFLINE: "" });
    const { calls } = mockFetch([route((u) => u.host === "geocoding-api.open-meteo.com", () => json({ results: SYNTHETIC_GEOCODE.slice(0, 6), generationtime_ms: 1 }))]);
    const res = await GET(ask("Melbourne", { "x-real-ip": "10.0.0.1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe("/v1/search");
    expect(calls[0].url.searchParams.get("name")).toBe("Melbourne");
    expect(calls[0].url.searchParams.get("count")).toBe("20");
    expect(body.mode).toBe("live");
    const ids = body.cities.map((c: { id: string }) => c.id);
    // The bay is not a populated place: left out.
    expect(ids).toEqual(["melbourne", "melbourne-florida-us", "tokyo-jp", "london-england-gb", "lisbon-pt"]);
    expect(body.cities[2]).toEqual({ id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", radiusKm: 15, region: "Tokyo" });
    // Each city's planning radius from its population and feature code; the built-in Melbourne keeps its own area.
    expect(body.cities.map((c: { radiusKm?: number }) => c.radiusKm)).toEqual([undefined, 6, 15, 15, 10]);
  });

  it("drops malformed rows and unknown time zones, keeps the rest", async () => {
    const { GET } = await load({ BUSKMAP_OFFLINE: "" });
    mockFetch([
      route(
        () => true,
        () => json({ results: [{ id: 1, name: "Broken" }, { ...SYNTHETIC_GEOCODE[2], timezone: "Mars/Base" }, SYNTHETIC_GEOCODE[5]] }),
      ),
    ]);
    const body = await (await GET(ask("Lis", { "x-real-ip": "10.0.0.2" }))).json();
    expect(body.cities.map((c: { id: string }) => c.id)).toEqual(["lisbon-pt"]);
  });

  it("answers no match with an empty list, and a geocoder outage with the fallback", async () => {
    const { GET } = await load({ BUSKMAP_OFFLINE: "" });
    mockFetch([route((u) => u.searchParams.get("name") === "Zzzz", () => json({ generationtime_ms: 1 })), route(() => true, () => json({}, 503))]);
    expect(await (await GET(ask("Zzzz", { "x-real-ip": "10.0.0.3" }))).json()).toMatchObject({ mode: "live", cities: [] });
    expect(await (await GET(ask("Down", { "x-real-ip": "10.0.0.3" }))).json()).toMatchObject({ mode: "fallback", reason: "http", cities: [] });
  });

  it("refuses a query under 2 letters", async () => {
    const { GET } = await load({ BUSKMAP_OFFLINE: "" });
    mockFetch([]);
    expect((await GET(ask("t"))).status).toBe(400);
  });

  it("serves the synthetic cities offline, with no request sent", async () => {
    const { GET } = await load({ BUSKMAP_OFFLINE: "1" });
    const { calls } = mockFetch([]);
    const body = await (await GET(ask("tok"))).json();
    expect(calls).toHaveLength(0);
    expect(body).toMatchObject({ mode: "synthetic", cities: [{ id: "tokyo-jp", name: "Tokyo" }] });
  });

  it("is BotID-listed for GET", async () => {
    const { BOTID_PROTECTED_ROUTES } = await import("@/lib/botid-routes");
    expect(BOTID_PROTECTED_ROUTES).toContainEqual({ path: "/api/cities", method: "GET" });
  });
});
