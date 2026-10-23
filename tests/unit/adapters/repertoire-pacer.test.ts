import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExhausted, CallBudget, CATALOGUE_DEADLINE_MS, countSpotifyCall, DAILY_MAX_CALLS, MAX_QUEUE_WAIT_MS, MemoryBackoffStore, MemoryUsageStore, paceSpotify, PACE_MS, WINDOW_MAX_CALLS, WINDOW_MS, resetPacerForTests, spotifyLimitedUntil } from "@/server/adapters/repertoire/pacer";
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
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, dailyMax: Infinity });
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

  it("when Spotify refuses Get Several Albums (HTTP 403), reads the albums one by one instead of losing the catalogue to Last.fm", async () => {
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      artistAlbums(25),
      route((u) => u.pathname === "/v1/albums", () => new Response("{}", { status: 403 })),
      route((u) => /^\/v1\/albums\/[^/]+\/tracks$/.test(u.pathname), (u) => json({ items: [track(u.pathname.split("/")[3])], next: null })),
    ]);
    const result = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(result.mode).toBe("live");
    expect(result.data).toHaveLength(25);
    // One refused batch call, then 25 single-album calls; the second group of 20 does not retry the batch.
    expect(albumCalls(calls)).toHaveLength(1);
    expect(calls.filter((c) => /\/v1\/albums\/[^/]+\/tracks$/.test(c.url.pathname))).toHaveLength(25);
  });

  it("spaces calls at least 500 ms apart, process-wide", async () => {
    vi.useFakeTimers();
    resetPacerForTests({ windowMax: Infinity, dailyMax: Infinity });
    const times: number[] = [];
    const all = Promise.all(Array.from({ length: 5 }, () => paceSpotify().then(() => times.push(Date.now()))));
    await vi.runAllTimersAsync();
    await all;
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps.every((g) => g >= 500)).toBe(true);
    expect(times[4] - times[0]).toBe(2000);
  });

  it("a budget with a deadline refuses calls past it and caps waits to the time left", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    const budget = new CallBudget(60, Date.now() + 20_000);
    budget.take();
    expect(budget.capWait(30_000)).toBe(20_000);
    vi.advanceTimersByTime(15_000);
    expect(budget.capWait(30_000)).toBe(5_000);
    expect(budget.capWait(1_000)).toBe(1_000);
    vi.advanceTimersByTime(5_000);
    expect(budget.remainingMs()).toBe(0);
    expect(() => budget.take()).toThrow(BudgetExhausted);
    expect(() => budget.take()).toThrow(/time for this Spotify fetch/);
    expect(budget.spent).toBe(1);
    // Without a deadline only the call count limits it.
    expect(new CallBudget(1).capWait(30_000)).toBe(30_000);
  });

  it("stops at the catalogue's 35 s deadline and returns the newest songs read so far (U34 pacing on a big catalogue)", async () => {
    expect(CATALOGUE_DEADLINE_MS).toBe(35_000);
    vi.useFakeTimers();
    // Real pace (500 ms) and window (20 calls per 30 s): the window fills in about 10 s, the next slot is past the deadline.
    resetPacerForTests({ dailyMax: Infinity });
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([tokenRoute, artistAlbums(450), batch()]);
    const started = Date.now();
    let doneAt = 0;
    const pending = getArtistCatalogue(LINK, "AU", LIVE).finally(() => (doneAt = Date.now()));
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    expect(result.mode).toBe("live");
    // 31 calls fit: a full window, then the next window from 30 s until the deadline. Newest releases first.
    expect(spotifyCalls(calls)).toHaveLength(31);
    expect(result.data.length).toBeGreaterThan(120);
    expect(result.data[0].title).toBe("Song al0");
    // It gave up as soon as the next free slot was past the deadline, rather than queueing 30 s for it.
    expect(doneAt - started).toBeLessThanOrEqual(CATALOGUE_DEADLINE_MS);
  });

  it("stops at the per-fetch call budget (60) and returns what it has", async () => {
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([tokenRoute, artistAlbums(450), batch()]);
    const result = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(spotifyCalls(calls)).toHaveLength(60);
    // Tracks are read as the release pages come in (two pages, then one batch of 20): 40 pages + 20 batches = 400 songs.
    expect(albumCalls(calls)).toHaveLength(20);
    expect(result.data).toHaveLength(400);
  });

  it("a long Retry-After pauses all Spotify calls until it passes, and survives a restart", async () => {
    vi.useFakeTimers();
    const store = new MemoryBackoffStore();
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, dailyMax: Infinity, store });
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
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, dailyMax: Infinity, store });
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
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, dailyMax: Infinity, store: new MemoryBackoffStore() });
    const { limitSpotifyUntil } = await import("@/server/adapters/repertoire/pacer");
    await limitSpotifyUntil(new Date(Date.now() + 3_600_000));
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([]);
    const result = await getArtistCatalogue(LINK, "AU", LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "rate_limited", data: [] });
    expect(calls).toHaveLength(0);
  });

  it("caps a rolling 30 s window at 20 calls, and fails fast past the queue allowance", async () => {
    vi.useFakeTimers();
    resetPacerForTests({ paceMs: 0, dailyMax: Infinity });
    // 20 calls start at once; the 21st would wait 30 s for the first to leave the window: over 4 s, so it fails fast.
    await Promise.all(Array.from({ length: WINDOW_MAX_CALLS }, () => paceSpotify()));
    await expect(paceSpotify()).rejects.toMatchObject({ kind: "rate_limited", message: expect.stringMatching(/\(returned HTTP 429\)$/) });
    // A caller that allows longer (a catalogue fetch) queues for the slot instead, which opens when the window moves on.
    let started = false;
    const waiting = paceSpotify(WINDOW_MS).then(() => (started = true));
    await vi.advanceTimersByTimeAsync(WINDOW_MS - 1);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(started).toBe(true);
  });

  it("steady load at the pace stays under 20 calls in any 30 s window", async () => {
    vi.useFakeTimers();
    resetPacerForTests({ dailyMax: Infinity });
    const times: number[] = [];
    const all = Promise.all(Array.from({ length: 60 }, () => paceSpotify(Infinity).then(() => times.push(Date.now()))));
    await vi.runAllTimersAsync();
    await all;
    for (const t of times) expect(times.filter((x) => x >= t && x < t + WINDOW_MS).length).toBeLessThanOrEqual(WINDOW_MAX_CALLS);
    expect(PACE_MS).toBe(500);
    expect(MAX_QUEUE_WAIT_MS).toBe(4_000);
  });

  it("a fail-fast from the window reaches the callers as a rate_limited fallback with no Spotify call", async () => {
    vi.useFakeTimers();
    resetPacerForTests({ paceMs: 0, windowMax: 1, dailyMax: Infinity });
    await paceSpotify();
    const { findArtists } = await fresh();
    const { calls } = mockFetch([tokenRoute]);
    expect(await findArtists("x", "AU", LIVE)).toMatchObject({ mode: "fallback", reason: "rate_limited" });
    expect(spotifyCalls(calls)).toHaveLength(0);
  });

  it("the daily cap opens the breaker until the next UTC midnight and fails later calls fast", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T15:30:00Z"));
    const usage = new MemoryUsageStore();
    const store = new MemoryBackoffStore();
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, store, usage });
    for (let i = 1; i < DAILY_MAX_CALLS; i++) await countSpotifyCall();
    expect(await spotifyLimitedUntil()).toBeNull();
    await countSpotifyCall(); // the 1,500th call still goes out, and opens the breaker
    const until = await spotifyLimitedUntil();
    expect(until!.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(await store.get("spotify")).toEqual(until);
    await expect(countSpotifyCall()).rejects.toMatchObject({ kind: "rate_limited" });

    // The next UTC day counts from zero again.
    vi.setSystemTime(new Date("2026-10-21T00:00:01Z"));
    expect(await spotifyLimitedUntil()).toBeNull();
    await expect(countSpotifyCall()).resolves.toBeUndefined();
  });

  it("a usage-store error is logged and the in-memory count still enforces the cap", async () => {
    const usage = { increment: vi.fn().mockRejectedValue(new Error("relation does not exist")) };
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, dailyMax: 3, store: new MemoryBackoffStore(), usage });
    await countSpotifyCall();
    await countSpotifyCall();
    await countSpotifyCall();
    await expect(countSpotifyCall()).rejects.toMatchObject({ kind: "rate_limited" });
    expect(usage.increment).toHaveBeenCalledTimes(4);
  });

  it("the shared count wins when another instance has counted more", async () => {
    const usage = { increment: vi.fn().mockResolvedValue(DAILY_MAX_CALLS + 1) };
    resetPacerForTests({ paceMs: 0, windowMax: Infinity, store: new MemoryBackoffStore(), usage });
    await expect(countSpotifyCall()).rejects.toMatchObject({ kind: "rate_limited" });
  });
});
