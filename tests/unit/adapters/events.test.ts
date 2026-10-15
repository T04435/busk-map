import { describe, expect, it, vi } from "vitest";
import { getEvents } from "@/server/adapters/events";
import { SYNTHETIC_RAW } from "@/server/adapters/events/fixtures/synthetic";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };

describe("getEvents", () => {
  it("fetches the city's whole window once by geoPoint and radius, then keeps the slot's events", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    vi.stubEnv("TICKETMASTER_API_KEY", "synthetic-test-key");
    vi.resetModules();
    const { getEvents: fresh } = await import("@/server/adapters/events");
    const { calls } = mockFetch([route((u) => u.host === "app.ticketmaster.com", () => json(SYNTHETIC_RAW))]);

    const result = await fresh("melbourne", slot, LIVE);

    expect(result.mode).toBe("live");
    const params = calls[0].url.searchParams;
    expect(params.get("geoPoint")).toMatch(/^r1r0fsn..$/);
    expect(params.get("radius")).toBe("3");
    expect(params.has("city")).toBe(false);
    // One request covers yesterday (UTC) through the next 8 days, whatever the slot.
    expect(params.get("startDateTime")).toBe("2026-10-15T00:00:00Z");
    expect(params.get("endDateTime")).toBe("2026-10-24T00:00:00Z");
    expect(params.get("page")).toBe("0");

    expect(result.data.map((e) => e.id)).toEqual(["syn-raw-1", "syn-raw-2"]);
    expect(result.data[0]).toMatchObject({
      venue: { name: "Synthetic Arena", lat: -37.8216, lon: 144.9785 },
      localTime: "19:30",
      endEstimated: true,
      end: "2026-10-17T11:30:00.000Z",
      segment: "Music",
      artists: [{ id: "syn-a", name: "Synthetic Rock Band" }],
    });
    // Sports attractions are teams, not artists.
    expect(result.data[1]).toMatchObject({ endEstimated: false, artists: [], venue: { name: "Venue" } });

    // A slot on another day gets none of these events, from the same kind of request.
    const other = await fresh("melbourne", { date: "2026-10-20", startHour: 9, endHour: 11 }, LIVE);
    expect(other.data).toEqual([]);
    vi.useRealTimers();
  });

  it("retries once when Ticketmaster stalls or errors", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "synthetic-test-key");
    vi.resetModules();
    const { getEvents: fresh } = await import("@/server/adapters/events");
    let n = 0;
    mockFetch([route((u) => u.host === "app.ticketmaster.com", () => (n++ === 0 ? new Response("busy", { status: 503 }) : json(SYNTHETIC_RAW)))]);
    const result = await fresh("melbourne", slot, LIVE);
    expect(n).toBe(2);
    expect(result.mode).toBe("live");
  });

  it("falls back to no events without a key", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "SET_ME");
    vi.resetModules();
    const { getEvents: fresh } = await import("@/server/adapters/events");
    const { calls } = mockFetch([]);
    const result = await fresh("melbourne", slot, LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "missing_key", data: [] });
    expect(calls).toHaveLength(0);
  });

  it("falls back to no events on a rate limit", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "synthetic-test-key");
    vi.resetModules();
    const { getEvents: fresh } = await import("@/server/adapters/events");
    mockFetch([route(() => true, () => json({ fault: "rate" }, 429))]);
    const result = await fresh("melbourne", slot, LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "rate_limited", data: [] });
  });

  it("serves synthetic events offline", async () => {
    const result = await getEvents("melbourne", slot, OFFLINE);
    expect(result.mode).toBe("synthetic");
    expect(result.data.length).toBe(5);
  });

  it("drops cancelled and postponed events: they draw no crowd", async () => {
    const { toCrowdEvent } = await import("@/server/adapters/events/client");
    const base = {
      id: "e1",
      name: "Gig",
      dates: { start: { dateTime: "2026-10-17T08:00:00Z", localTime: "19:00:00" } },
      _embedded: { venues: [{ id: "v1", name: "170 Russell", location: { latitude: "-37.81", longitude: "144.97" } }] },
    };
    expect(toCrowdEvent(base)).not.toBeNull();
    expect(toCrowdEvent({ ...base, dates: { ...base.dates, status: { code: "postponed" } } })).toBeNull();
    expect(toCrowdEvent({ ...base, dates: { ...base.dates, status: { code: "cancelled" } } })).toBeNull();
    expect(toCrowdEvent({ ...base, name: "POSTPONED | Soen" })).toBeNull();
    expect(toCrowdEvent({ ...base, name: "CANCELLED - Big Show" })).toBeNull();
  });
});
