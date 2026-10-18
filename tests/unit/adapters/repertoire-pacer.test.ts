import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryBackoffStore, paceSpotify, resetPacerForTests, spotifyLimitedUntil } from "@/server/adapters/repertoire/pacer";
import { json, LIVE, mockFetch, route } from "../../helpers";

const LINK = "https://open.spotify.com/artist/0SNWoGaDlrCompmg9rXeNq";
const tokenRoute = route((u) => u.host === "accounts.spotify.com", () => json({ access_token: "t", expires_in: 3600 }));
const artistAlbums = (count: number) =>
  route(
    (u) => /^\/v1\/artists\/[^/]+\/albums$/.test(u.pathname),
    (u) => {
      const offset = Number(u.searchParams.get("offset") ?? 0);
      const items = Array.from({ length: Math.min(10, count - offset) }, (_, i) => ({ id: `al${offset + i}`, name: `Album ${offset + i}`, album_type: "album" }));
      const next = offset + 10 < count ? `https://api.spotify.com/v1/artists/x/albums?offset=${offset + 10}&limit=10` : null;
      return json({ items, next });
    },
  );
const track = (id: string) => ({ id: `t-${id}`, name: `Song ${id}`, artists: [{ id: "a1", name: "Synthetic Artist" }] });
const batch = (extra: (id: string) => object = () => ({})) =>
  route(
    (u) => u.pathname === "/v1/albums",
    (u) => json({ albums: (u.searchParams.get("ids") ?? "").split(",").map((id) => ({ id, name: `Album ${id}`, tracks: { items: [track(id)], next: null }, ...extra(id) })) }),
  );
const spotifyCalls = (calls: { url: URL }[]) => calls.filter((c) => c.url.host === "api.spotify.com");
const albumCalls = (calls: { url: URL }[]) => calls.filter((c) => c.url.pathname === "/v1/albums");

async function fresh() {
  vi.resetModules();
  return import("@/server/adapters/repertoire");
}

describe("Spotify pacer, budget and breaker (U34)", () => {
  beforeEach(() => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "synthetic-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "synthetic-secret");
    resetPacerForTests({ paceMs: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches 256 releases in at most 14 album calls and follows tracks.next for a long album", async () => {
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      artistAlbums(256),
      route((u) => u.pathname === "/v1/albums/al5/tracks", () => json({ items: [track("al5-b")], next: null })),
      batch((id) => (id === "al5" ? { tracks: { items: [track("al5")], next: "https://api.spotify.com/v1/albums/al5/tracks?offset=50&limit=50" } } : {})),
    ]);
    const result = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(result.mode).toBe("live");
    expect(albumCalls(calls).length).toBeLessThanOrEqual(14);
    expect(albumCalls(calls)).toHaveLength(13);
    expect(calls.filter((c) => c.url.pathname === "/v1/albums/al5/tracks")).toHaveLength(1);
    expect(result.data).toHaveLength(257);
    expect(spotifyCalls(calls)).toHaveLength(26 + 13 + 1);
  });

  it("spaces calls at least 250 ms apart, process-wide", async () => {
    vi.useFakeTimers();
    resetPacerForTests();
    const times: number[] = [];
    const all = Promise.all(Array.from({ length: 5 }, () => paceSpotify().then(() => times.push(Date.now()))));
    await vi.runAllTimersAsync();
    await all;
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps.every((g) => g >= 250)).toBe(true);
    expect(times[4] - times[0]).toBe(1000);
  });

  it("stops at the per-fetch call budget (60) and returns what it has", async () => {
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([tokenRoute, artistAlbums(450), batch()]);
    const result = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(spotifyCalls(calls)).toHaveLength(60);
    expect(albumCalls(calls)).toHaveLength(15);
    expect(result.data).toHaveLength(300);
  });

  it("a long Retry-After pauses all Spotify calls until it passes, and survives a restart", async () => {
    vi.useFakeTimers();
    const store = new MemoryBackoffStore();
    resetPacerForTests({ paceMs: 0, store });
    const { getArtistCatalogue, findArtists } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname === "/v1/search", () => json({ artists: { items: [] } })),
      route((u) => u.pathname.includes("/artists/"), () => new Response("{}", { status: 429, headers: { "retry-after": "73292" } })),
    ]);
    const first = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(first).toMatchObject({ mode: "fallback", reason: "rate_limited", data: [] });
    const spent = spotifyCalls(calls).length;
    expect(spent).toBe(1);

    const until = await spotifyLimitedUntil();
    expect(until!.getTime()).toBe(Date.now() + 73_292_000);
    expect(await store.get("spotify")).toEqual(until);

    // Every other Spotify call fails fast: no network.
    expect(await findArtists("x", "AU", LIVE)).toMatchObject({ mode: "fallback", reason: "rate_limited" });
    expect(await getArtistCatalogue(LINK, "AU", LIVE)).toMatchObject({ mode: "fallback" });
    expect(spotifyCalls(calls)).toHaveLength(spent);

    // A restarted instance reads the stored time.
    resetPacerForTests({ paceMs: 0, store });
    expect(await spotifyLimitedUntil()).toEqual(until);
    expect(await findArtists("x", "AU", LIVE)).toMatchObject({ mode: "fallback", reason: "rate_limited" });
    expect(spotifyCalls(calls)).toHaveLength(spent);

    // Once the time passes, calls go out again.
    vi.setSystemTime(until!.getTime() + 1000);
    expect(await spotifyLimitedUntil()).toBeNull();
    expect(await findArtists("x", "AU", LIVE)).toMatchObject({ mode: "live" });
    expect(spotifyCalls(calls)).toHaveLength(spent + 1);
  });

  it("a short Retry-After waits once and retries once; a second 429 opens a one-minute pause", async () => {
    vi.useFakeTimers();
    const { findArtists } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname === "/v1/search", () => new Response("{}", { status: 429, headers: { "retry-after": "5" } })),
    ]);
    const pending = findArtists("x", "AU", LIVE);
    await vi.advanceTimersByTimeAsync(4_900);
    expect(spotifyCalls(calls)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(await pending).toMatchObject({ mode: "fallback", reason: "rate_limited" });
    expect(spotifyCalls(calls)).toHaveLength(2);
    const until = await spotifyLimitedUntil();
    expect(until!.getTime() - Date.now()).toBeGreaterThan(59_000);
    expect(until!.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
  });

  it("never caches a fail-fast: the catalogue throws while limited, so the fallback runs each time", async () => {
    resetPacerForTests({ paceMs: 0, store: new MemoryBackoffStore() });
    const { limitSpotifyUntil } = await import("@/server/adapters/repertoire/pacer");
    await limitSpotifyUntil(new Date(Date.now() + 3_600_000));
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([]);
    const result = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "rate_limited", data: [] });
    expect(calls).toHaveLength(0);
  });
});
