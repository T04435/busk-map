import { describe, expect, it } from "vitest";
import { getFootfall, FOOTFALL_FALLBACK } from "@/server/adapters/footfall";
import { SYNTHETIC_RAW } from "@/server/adapters/footfall/fixtures/synthetic";
import { json, LIVE, mockFetch, OFFLINE, route, timeoutError } from "../../helpers";

const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };
const today = "2026-10-15";

function dataset(url: URL) {
  return url.pathname.split("/").at(-2);
}

function happyRoutes() {
  return [
    route((u) => dataset(u) === "pedestrian-counting-system-sensor-locations", (u) =>
      u.searchParams.get("offset") === "0" ? json(SYNTHETIC_RAW.sensors) : json({ total_count: 3, results: [] }),
    ),
    route((u) => dataset(u) === "pedestrian-counting-system-monthly-counts-per-hour", () => json(SYNTHETIC_RAW.averages)),
    route(
      (u) => dataset(u) === "pedestrian-counting-system-past-hour-counts-per-minute" && u.searchParams.get("select")!.startsWith("max("),
      () => json(SYNTHETIC_RAW.latest),
    ),
    route((u) => dataset(u) === "pedestrian-counting-system-past-hour-counts-per-minute", () => json(SYNTHETIC_RAW.live)),
  ];
}

describe("getFootfall", () => {
  it("joins sensors, the slot baseline and the live feed", async () => {
    const { calls } = mockFetch(happyRoutes());
    const result = await getFootfall("melbourne", slot, LIVE, today);

    expect(result.mode).toBe("live");
    expect(result.source).toBe("melbourne-pedestrian");
    // The inactive synthetic sensor (status "I") is dropped.
    expect(result.data.sensors.map((s) => s.id)).toEqual([9001, 9002]);
    expect(result.data.sensors[0]).toMatchObject({ avgHourly: 1200.5, samples: 24, liveLastHour: 410 });
    expect(result.data.sensors[1]).toMatchObject({ avgHourly: null, samples: 0, liveLastHour: null });
    expect(result.data.liveAsOf).toBe("2026-10-14T14:04:00+00:00");

    const history = calls.find((c) => dataset(c.url) === "pedestrian-counting-system-monthly-counts-per-hour")!;
    const where = history.url.searchParams.get("where")!;
    expect(where).toContain("hourday >= 18 and hourday < 21");
    // Eight Saturdays strictly before "today".
    expect(result.data.baselineDates).toHaveLength(8);
    expect(result.data.baselineDates[0]).toBe("2026-10-10");
    expect(where).toContain("sensing_date = date'2026-10-10'");
    expect(where).toContain("sensing_date = date'2026-08-22'");

    const live = calls.find((c) => c.url.searchParams.get("select")?.startsWith("location_id, sum"))!;
    expect(live.url.searchParams.get("where")).toBe("sensing_datetime > date'2026-10-14T13:04:00+00:00'");
  });

  it("keeps the baseline when only the live feed fails", async () => {
    const routes = happyRoutes();
    routes[2] = route((u) => u.searchParams.get("select")!.startsWith("max("), () => json({}, 503));
    mockFetch(routes);
    const result = await getFootfall("melbourne", slot, LIVE, today);
    expect(result.mode).toBe("live");
    expect(result.data.liveAsOf).toBeNull();
    expect(result.data.sensors[0].liveLastHour).toBeNull();
    expect(result.data.sensors[0].avgHourly).toBe(1200.5);
  });

  it("returns no live counts when the live feed is empty", async () => {
    const routes = happyRoutes();
    routes[2] = route((u) => u.searchParams.get("select")!.startsWith("max("), () => json({ results: [] }));
    mockFetch(routes);
    const result = await getFootfall("melbourne", slot, LIVE, today);
    expect(result.data.liveAsOf).toBeNull();
  });

  it("falls back on a timeout", async () => {
    mockFetch([route(() => true, () => Promise.reject(timeoutError()))]);
    const result = await getFootfall("melbourne", slot, LIVE, today);
    expect(result).toMatchObject({ mode: "fallback", reason: "timeout", data: FOOTFALL_FALLBACK });
  });

  it("falls back on an unexpected shape", async () => {
    mockFetch([route(() => true, () => json({ results: [{ location_id: "x" }] }))]);
    const result = await getFootfall("melbourne", slot, LIVE, today);
    expect(result).toMatchObject({ mode: "fallback", reason: "invalid_response" });
  });

  it("serves synthetic data offline without calling the network", async () => {
    const { calls } = mockFetch([]);
    const result = await getFootfall("melbourne", slot, OFFLINE, today);
    expect(result.mode).toBe("synthetic");
    expect(result.data.sensors.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(0);
  });

  it("honours fault injection", async () => {
    const result = await getFootfall("melbourne", slot, { offline: true, faults: ["footfall"] }, today);
    expect(result).toMatchObject({ mode: "fallback", reason: "fault_injected" });
  });
});
