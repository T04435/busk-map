import { describe, expect, it, vi } from "vitest";
import { getEvents } from "@/server/adapters/events";
import { SYNTHETIC_RAW } from "@/server/adapters/events/fixtures/synthetic";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };

describe("getEvents", () => {
  it("searches by geoPoint and radius around the slot, and normalises events", async () => {
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
    // 6 pm Melbourne daylight time is 07:00 UTC; minus the 4 h look-back.
    expect(params.get("startDateTime")).toBe("2026-10-17T03:00:00Z");
    expect(params.get("endDateTime")).toBe("2026-10-17T10:00:00Z");

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
