import { describe, expect, it } from "vitest";
import { MELBOURNE } from "@/lib/city";
import { wktPoint, wktPolygon } from "@/lib/geo";
import { handleQlooMock } from "@/server/qloo-mock/handler";
import { TOKYO } from "@/server/offline-city";

/** Offline mode's second city: the mock answers Tokyo with Melbourne's synthetic field moved onto Tokyo's centre. */
async function call(path: string, params: Record<string, string>) {
  const res = await handleQlooMock(new Request(`https://qloo-mock.invalid${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": "test" } }));
  return (await res.json()) as { results: Record<string, unknown> };
}

const artistId = async (name: string) => ((await call("/search", { query: name, types: "urn:entity:artist", take: "1" })).results as unknown as { entity_id: string }[])[0].entity_id;

describe("qloo mock: a second city offline", () => {
  it("has the same heatmap over Tokyo as over Melbourne, moved", async () => {
    const id = await artistId("Paul Kelly");
    const heat = async (box: typeof MELBOURNE.bbox) =>
      (await call("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": id, "filter.location": wktPolygon(box) })).results.heatmap as { location: { latitude: number; longitude: number } }[];
    const there = await heat(TOKYO.bbox);
    const here = await heat(MELBOURNE.bbox);
    expect(there.length).toBeGreaterThan(0);
    expect(Math.abs(there.length - here.length)).toBeLessThan(here.length * 0.2);
    expect(there.every((c) => Math.abs(c.location.latitude - TOKYO.center.lat) < 0.1)).toBe(true);
  });

  it("finds synthetic places around Tokyo, never with a Melbourne venue's name", async () => {
    const id = await artistId("Paul Kelly");
    const { results } = await call("/v2/insights", { "filter.type": "urn:entity:place", "signal.interests.entities": id, "filter.location": wktPoint(TOKYO.center), "filter.location.radius": "2000", take: "20" });
    const entities = results.entities as { name: string; location: { lat: number; lon: number } }[];
    expect(entities.length).toBeGreaterThan(0);
    for (const e of entities) expect(e.name).toMatch(/^Synthetic /);
  });

  it("has nothing for a city that isn't mocked", async () => {
    const id = await artistId("Paul Kelly");
    const paris = { south: 48.84, west: 2.32, north: 48.87, east: 2.37 };
    const { results } = await call("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": id, "filter.location": wktPolygon(paris) });
    expect(results.heatmap).toEqual([]);
  });
});
