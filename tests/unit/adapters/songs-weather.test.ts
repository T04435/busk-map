import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYNTHETIC_RAW as SONGS_RAW } from "@/server/adapters/songs/fixtures/synthetic";
import { SYNTHETIC_RAW as WEATHER_RAW } from "@/server/adapters/weather/fixtures/synthetic";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

async function freshSongs() {
  vi.resetModules();
  return import("@/server/adapters/songs");
}

describe("getSongs (Last.fm)", () => {
  beforeEach(() => vi.stubEnv("LASTFM_API_KEY", "synthetic-test-key"));

  it("fetches top tracks per artist and skips malformed tracks", async () => {
    const { getSongs } = await freshSongs();
    const { calls } = mockFetch([
      route((u) => u.searchParams.get("artist") === "Synthetic Artist", () => json(SONGS_RAW.ok)),
      route((u) => u.searchParams.get("artist") === "Synthetic Solo", () => json(SONGS_RAW.single)),
      route((u) => u.searchParams.get("artist") === "Nobody", () => json(SONGS_RAW.notFound)),
    ]);
    const result = await getSongs(["Synthetic Artist", "Synthetic Solo", "Nobody", " ", "Synthetic Artist"], LIVE);
    expect(result.mode).toBe("live");
    expect(calls).toHaveLength(3);
    expect(calls[0].url.searchParams.get("method")).toBe("artist.gettoptracks");
    expect(result.data["Synthetic Artist"]).toEqual([
      { title: "Synthetic Song One", artist: "Synthetic Artist", playcount: 1000, listeners: 300, url: "https://example.com/1" },
      { title: "Synthetic Song Two", artist: "Synthetic Artist", playcount: 500, listeners: 100, url: null },
    ]);
    expect(result.data["Synthetic Solo"]).toHaveLength(1);
    expect(result.data.Nobody).toEqual([]);
  });

  it("keeps the artists that worked when one lookup fails", async () => {
    const { getSongs } = await freshSongs();
    mockFetch([
      route((u) => u.searchParams.get("artist") === "A", () => json(SONGS_RAW.ok)),
      route((u) => u.searchParams.get("artist") === "B", () => json({}, 500)),
    ]);
    const result = await getSongs(["A", "B"], LIVE);
    expect(result.mode).toBe("live");
    expect(Object.keys(result.data)).toEqual(["A"]);
  });

  it("falls back when every lookup fails, including Last.fm error codes", async () => {
    const { getSongs } = await freshSongs();
    mockFetch([route(() => true, () => json(SONGS_RAW.badKey))]);
    const result = await getSongs(["A", "B"], LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "http", data: {} });
  });

  it("falls back without a key, and is synthetic offline", async () => {
    vi.stubEnv("LASTFM_API_KEY", "");
    const { getSongs } = await freshSongs();
    expect(await getSongs(["A"], LIVE)).toMatchObject({ mode: "fallback", reason: "missing_key" });
    const offline = await getSongs(["A"], OFFLINE);
    expect(offline.mode).toBe("synthetic");
    expect(offline.data.A).toHaveLength(5);
  });
});

describe("getListeners (Last.fm)", () => {
  beforeEach(() => vi.stubEnv("LASTFM_API_KEY", "synthetic-test-key"));

  it("reads artist.getInfo listeners, null for unknown artists, skipping failed lookups", async () => {
    const { getListeners } = await freshSongs();
    const { calls } = mockFetch([
      route((u) => u.searchParams.get("artist") === "Synthetic Artist", () => json(SONGS_RAW.info)),
      route((u) => u.searchParams.get("artist") === "Synthetic Two", () => json(SONGS_RAW.infoNumeric)),
      route((u) => u.searchParams.get("artist") === "Nobody", () => json(SONGS_RAW.notFound)),
      route((u) => u.searchParams.get("artist") === "Odd", () => json(SONGS_RAW.infoBad)),
    ]);
    const result = await getListeners(["Synthetic Artist", "Synthetic Two", "Nobody", "Odd", " ", "Synthetic Artist"], LIVE);
    expect(result).toMatchObject({ mode: "live", data: { "Synthetic Artist": 123456, "Synthetic Two": 42, Nobody: null } });
    expect(result.data).not.toHaveProperty("Odd");
    expect(calls).toHaveLength(4);
    expect(calls[0].url.searchParams.get("method")).toBe("artist.getinfo");
    expect(calls[0].url.searchParams.get("autocorrect")).toBe("1");
  });

  it("falls back when every lookup fails or the key is missing, and is synthetic offline", async () => {
    const { getListeners } = await freshSongs();
    mockFetch([route(() => true, () => json(SONGS_RAW.badKey))]);
    expect(await getListeners(["A", "B"], LIVE)).toMatchObject({ mode: "fallback", reason: "http", data: {} });

    vi.stubEnv("LASTFM_API_KEY", "");
    const again = await freshSongs();
    expect(await again.getListeners(["A"], LIVE)).toMatchObject({ mode: "fallback", reason: "missing_key", data: {} });

    const offline = await again.getListeners(["A", "A", "B"], OFFLINE);
    expect(offline.mode).toBe("synthetic");
    expect(Object.keys(offline.data)).toEqual(["A", "B"]);
    expect(offline.data.A).toBe((await again.getListeners(["A"], OFFLINE)).data.A);
  });

  it("caps one lookup at ten artists", async () => {
    const { getListeners, MAX_LISTENER_ARTISTS } = await freshSongs();
    const { calls } = mockFetch([route(() => true, () => json(SONGS_RAW.info))]);
    await getListeners(Array.from({ length: 15 }, (_, i) => `Artist ${i}`), LIVE);
    expect(calls).toHaveLength(MAX_LISTENER_ARTISTS);
  });
});

describe("getWeather (Open-Meteo)", () => {
  const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };

  it("returns the slot's hours in local time", async () => {
    const { getWeather } = await import("@/server/adapters/weather");
    const { calls } = mockFetch([route((u) => u.host === "api.open-meteo.com", () => json(WEATHER_RAW))]);
    const result = await getWeather("melbourne", slot, LIVE, "2026-10-15");
    expect(result.mode).toBe("live");
    expect(calls[0].url.searchParams.get("timezone")).toBe("Australia/Melbourne");
    expect(calls[0].url.searchParams.get("start_date")).toBe("2026-10-17");
    expect(result.data?.hours.map((h) => h.hour)).toEqual([18, 19, 20]);
    expect(result.data?.hours[0]).toEqual({
      hour: 18,
      temperatureC: 19,
      precipitationProbability: 70,
      precipitationMm: 1.2,
      windKmh: 15,
      weatherCode: 61,
    });
    expect(result.data?.hours[2].weatherCode).toBeNull();
  });

  it("falls back outside the forecast range without calling the API", async () => {
    const { getWeather } = await import("@/server/adapters/weather");
    const { calls } = mockFetch([]);
    const late = await getWeather("melbourne", { ...slot, date: "2026-11-30" }, LIVE, "2026-10-15");
    expect(late).toMatchObject({ mode: "fallback", reason: "not_found", data: null });
    const early = await getWeather("melbourne", { ...slot, date: "2026-10-01" }, LIVE, "2026-10-15");
    expect(early.mode).toBe("fallback");
    expect(calls).toHaveLength(0);
  });

  it("is synthetic offline", async () => {
    const { getWeather } = await import("@/server/adapters/weather");
    const result = await getWeather("melbourne", slot, OFFLINE, "2026-10-15");
    expect(result.mode).toBe("synthetic");
    expect(result.data?.hours).toHaveLength(3);
  });
});
