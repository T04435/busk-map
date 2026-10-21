import { describe, expect, it, vi } from "vitest";
import { weekPlanSchema, weekRequestSchema } from "@/lib/week-schema";
import { EXAMPLES } from "@/lib/examples";
import { LIVE, mockFetch, OFFLINE } from "../../helpers";

const request = weekRequestSchema.parse({ city: "melbourne", performer: EXAMPLES[1].performer, startDate: "2026-10-15" });
// 01:00 on the 15th in Melbourne: every slot of the week is still ahead.
const now = new Date("2026-10-14T14:00:00Z");

async function load() {
  vi.resetModules();
  return import("@/server/agent/week");
}

describe("week planner (offline)", () => {
  it("scores 7 days × 4 slots and picks up to five sessions, one per day", async () => {
    mockFetch([]);
    const { buildWeekPlan } = await load();
    const plan = await buildWeekPlan(request, OFFLINE, "2026-10-15", false, now);
    expect(() => weekPlanSchema.parse(plan)).not.toThrow();
    expect(plan.days).toHaveLength(7);
    expect(plan.grid).toHaveLength(28);
    expect(plan.sessions).toHaveLength(5);
    expect(new Set(plan.sessions.map((s) => s.date)).size).toBe(5);
    expect(plan.sessions[0].score).toBeGreaterThanOrEqual(plan.sessions[4].score);
    expect(plan.explanations).toBe("template");
    expect(plan.grid.filter((c) => c.chosen)).toHaveLength(5);
    expect(plan.grid.every((c) => !c.past)).toBe(true);
  });

  it("shows what makes each day different: estimated activity, events and weather", async () => {
    const { buildWeekPlan, dayDrivers } = await load();
    const plan = await buildWeekPlan(request, OFFLINE, "2026-10-15", false, now);
    const shares = plan.days.map((d) => d.busyness);
    expect(new Set(shares).size).toBeGreaterThan(3);
    expect(shares).toContain(1);
    expect(plan.days.every((d) => d.drivers.length >= 2)).toBe(true);
    expect(plan.days.some((d) => d.drivers.some((line) => /^Busiest day/.test(line)))).toBe(true);
    expect(plan.days.some((d) => d.drivers.some((line) => /ticketed event/.test(line)))).toBe(true);
    expect(plan.grid.some((c) => c.flags.length > 0)).toBe(true);
    // Different days pick different best slots, not one slot repeated all week.
    expect(new Set(plan.sessions.map((s) => s.startHour)).size).toBeGreaterThan(1);

    expect(
      dayDrivers(
        { date: "2026-10-17", weekday: "saturday" },
        { busyness: null, busiestHour: null, events: [], forecast: [{ hour: 12, precipitationProbability: 60, temperatureC: null }], timeZone: "Australia/Melbourne" },
      ),
    ).toEqual(["Rain likely (up to 60%)"]);
    const run = (date: string) => ({ name: "Long exhibition", venue: { name: "Museum" }, start: `${date}T00:00:00Z` });
    expect(
      dayDrivers(
        { date: "2026-10-17", weekday: "saturday" },
        { busyness: 0.96, busiestHour: null, events: ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"].map(run), forecast: [], timeZone: "Australia/Melbourne" },
      ),
    ).toEqual(["About as busy as the busiest day (96%, estimate from Qloo: popular places open)"]);
    expect(
      dayDrivers(
        { date: "2026-10-17", weekday: "saturday" },
        { busyness: 0.5, busiestHour: 13, events: [], forecast: [{ hour: 12, precipitationProbability: 30, temperatureC: 21.4 }], timeZone: "Australia/Melbourne" },
      ),
    ).toEqual(["Activity about 50% of the week's busiest day (estimate from Qloo: popular places open)", "Some rain risk (up to 30%), up to 21°C"]);
  });

  it("explains only the chosen sessions with the model", async () => {
    const { buildWeekPlan } = await load();
    const plan = await buildWeekPlan(request, OFFLINE, "2026-10-15", true, now);
    expect(plan.explanations).toBe("ai");
    expect(plan.explanationsModel).toBe("mock");
    expect(plan.sessions.every((s) => s.whySource === "ai" && s.why === `Mock explanation for ${s.key}.`)).toBe(true);
    expect(plan.summary).toBe("Mock week summary (offline test mode).");
  });

  it("respects unavailable times and skips slots that have started", async () => {
    const { buildWeekPlan } = await load();
    const first = await buildWeekPlan(request, OFFLINE, "2026-10-15", false, now);
    const blocked = first.sessions[0];
    const limited = weekRequestSchema.parse({
      ...request,
      limits: { maxSessions: 2, maxPerDay: 1, unavailable: [{ date: blocked.date, startHour: blocked.startHour, endHour: blocked.endHour }] },
    });
    const plan = await buildWeekPlan(limited, OFFLINE, "2026-10-15", false, now);
    expect(plan.sessions).toHaveLength(2);
    expect(plan.sessions.some((s) => s.key === blocked.key)).toBe(false);
    expect(plan.grid.find((c) => c.date === blocked.date && c.startHour === blocked.startHour)?.unavailable).toBe(true);

    const evening = await buildWeekPlan(request, OFFLINE, "2026-10-15", false, new Date("2026-10-15T09:30:00Z"));
    expect(evening.grid.filter((c) => c.past).map((c) => c.startHour)).toEqual([10, 13, 16, 19]);
    expect(evening.sessions.every((s) => s.date !== "2026-10-15")).toBe(true);
  }, 20_000);

  it("stops before spending anything when Qloo is down", async () => {
    const { buildWeekPlan, WeekQlooUnavailableError } = await load();
    await expect(buildWeekPlan(request, { offline: true, faults: ["qloo"] }, "2026-10-15", true, now)).rejects.toBeInstanceOf(WeekQlooUnavailableError);
  });

  it("still plans with less data, and uses template reasons without a gateway", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("QLOO_API_KEY", "");
    const { buildWeekPlan } = await load();
    const { json, route } = await import("../../helpers");
    // One general-permit music site from the (mocked) council layers.
    mockFetch([
      route((u) => u.host === "www.arcgis.com", () =>
        json({ layers: [{ featureSet: { features: [{ geometry: { x: 16137000, y: -4553500 }, attributes: { FID: 1, Location: "Synthetic lawn", Permit_Typ: " ", Descriptio: "", Busking_Al: "Y", Music_Allo: "Y", Circle_Act: " " } }] } }] }),
      ),
      route((u) => u.host.startsWith("services1"), () => json({ type: "FeatureCollection", features: [] })),
    ]);
    const plan = await buildWeekPlan(request, { offline: false, faults: ["events", "weather"] }, "2026-10-15", true, now);
    expect(plan.days.every((d) => !d.hasForecast)).toBe(true);
    expect(plan.explanations).toBe("template");
    expect(plan.notes.join(" ")).toMatch(/not configured/);
    // The activity estimate needs no source but Qloo, so sessions are still found.
    expect(plan.sessions.length).toBeGreaterThan(0);
  });

  it("returns no sessions when the rules are unavailable", async () => {
    const { buildWeekPlan } = await load();
    const plan = await buildWeekPlan(request, { offline: true, faults: ["pitches"] }, "2026-10-15", false, now);
    expect(plan.sessions).toEqual([]);
    expect(plan.summary).toMatch(/No session/);
    expect(plan.notes.join(" ")).toMatch(/busking rules are unavailable/);
  });
});

describe("week adapters (live, mocked fetch)", () => {
  it("reads a week of weather keyed by date, clipped to the forecast range", async () => {
    vi.resetModules();
    const { getWeatherWeek } = await import("@/server/adapters/weather");
    const { json, route } = await import("../../helpers");
    const hours = Array.from({ length: 48 }, (_, i) => `2026-10-${i < 24 ? "29" : "30"}T${String(i % 24).padStart(2, "0")}:00`);
    const { calls } = mockFetch([
      route(() => true, () =>
        json({ hourly: { time: hours, temperature_2m: hours.map(() => 20), precipitation_probability: hours.map(() => 0), precipitation: hours.map(() => 0), wind_speed_10m: hours.map(() => 5), weather_code: hours.map(() => 1) } }),
      ),
    ]);
    const result = await getWeatherWeek("melbourne", "2026-10-24", 7, LIVE, "2026-10-15");
    expect(calls[0].url.searchParams.get("end_date")).toBe("2026-10-30");
    expect(Object.keys(result.data)).toEqual(["2026-10-29", "2026-10-30"]);
    expect(result.data["2026-10-30"]).toHaveLength(24);

    const beyond = await getWeatherWeek("melbourne", "2026-11-20", 7, LIVE, "2026-10-15");
    expect(beyond).toMatchObject({ mode: "fallback", reason: "not_found", data: {} });
    expect(Object.keys((await getWeatherWeek("melbourne", "2026-10-15", 7, OFFLINE, "2026-10-15")).data)).toHaveLength(7);
  });

  it("searches events across the whole week with the city's single daily request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T13:00:00Z"));
    vi.stubEnv("TICKETMASTER_API_KEY", "synthetic-test-key");
    vi.resetModules();
    const { getEventsBetween } = await import("@/server/adapters/events");
    const { json, route } = await import("../../helpers");
    const { calls } = mockFetch([route(() => true, () => json({ page: { totalElements: 0 } }))]);
    const result = await getEventsBetween("melbourne", "2026-10-14T13:00:00.000Z", "2026-10-21T13:00:00.000Z", LIVE);
    expect(result).toMatchObject({ mode: "live", data: [] });
    expect(calls).toHaveLength(1);
    // Yesterday (UTC) through the next 8 days covers the whole week being planned.
    expect(calls[0].url.searchParams.get("startDateTime")).toBe("2026-10-13T00:00:00Z");
    expect(calls[0].url.searchParams.get("endDateTime")).toBe("2026-10-22T00:00:00Z");
    vi.useRealTimers();
  });
});
