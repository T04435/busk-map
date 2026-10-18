import { beforeEach, describe, expect, it, vi } from "vitest";
import { spotifyIdSchema } from "@/lib/plan-schema";
import { SYNTHETIC_RAW, syntheticScopedTrackSearch, syntheticSpotifyId } from "@/server/adapters/repertoire/fixtures/synthetic";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

async function fresh() {
  vi.resetModules();
  return import("@/server/adapters/repertoire");
}

const tokenRoute = route((u) => u.host === "accounts.spotify.com", () => json(SYNTHETIC_RAW.token));

describe("repertoire (Spotify)", () => {
  beforeEach(() => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "synthetic-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "synthetic-secret");
  });

  it("parses artist links, URIs and ids", async () => {
    const { parseSpotifyArtistId } = await fresh();
    const id = "0SNWoGaDlrCompmg9rXeNq";
    expect(parseSpotifyArtistId(`https://open.spotify.com/artist/${id}?si=abc`)).toBe(id);
    expect(parseSpotifyArtistId(`https://open.spotify.com/intl-es/artist/${id}`)).toBe(id);
    expect(parseSpotifyArtistId(`spotify:artist:${id}`)).toBe(id);
    expect(parseSpotifyArtistId(id)).toBe(id);
    expect(parseSpotifyArtistId("https://example.com/artist/nope")).toBeNull();
  });

  it("normalises song titles", async () => {
    const { songKey } = await fresh();
    expect(songKey("Synthetic Original - Radio Edit")).toBe("synthetic original");
    expect(songKey("Second Song (Remastered 2026)")).toBe("second song");
    expect(songKey("Café del Mar")).toBe("café del mar");
  });

  it("searches tracks and artists with a client-credentials token", async () => {
    const { findTracks, findArtists } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname === "/v1/search", () => json(SYNTHETIC_RAW.search)),
    ]);
    const tracks = await findTracks("synthetic", "AU", LIVE);
    const artists = await findArtists("synthetic", "AU", LIVE);
    expect(tracks.data).toEqual([
      {
        id: "t1",
        title: "Synthetic Track",
        artists: [{ id: "a1", name: "Synthetic Artist" }],
        album: "Synthetic Album",
        image: "https://i.scdn.co/image/syn-64",
        durationMs: 215_000,
        url: "https://open.spotify.com/track/t1",
        year: 1999,
      },
    ]);
    // Photo (smallest at least 64 px); release counts are not fetched by the search.
    expect(artists.mode).toBe("live");
    expect(artists.data).toEqual([
      { id: "a1", name: "Synthetic Artist", image: "https://i.scdn.co/image/syn-artist-160", releases: null, url: "https://open.spotify.com/artist/a1" },
      { id: "a2", name: "Synthetic Two", image: null, releases: null, url: null },
    ]);
    expect(calls.some((c) => c.url.pathname.endsWith("/albums"))).toBe(false);
    // One token for every call; search limit respects Spotify's cap of 10.
    expect(calls.filter((c) => c.url.host === "accounts.spotify.com")).toHaveLength(1);
    const search = calls.find((c) => c.url.pathname === "/v1/search")!;
    expect(search.url.searchParams.get("limit")).toBe("10");
    expect((search.init?.headers as Record<string, string>).Authorization).toBe("Bearer synthetic-token");
  });

  it("puts the act's artists' versions first, with one capped scoped query per artist", async () => {
    const { findTracks } = await fresh();
    // SYNTHETIC: a plain search led by another act's version; scoped searches find Celia Cruz's own takes.
    const raw = (id: string, name: string, artistId: string, artist: string) => ({ id, name, artists: [{ id: artistId, name: artist }], album: { name: "A", images: [] } });
    const { calls } = mockFetch([
      tokenRoute,
      route(
        (u) => u.pathname === "/v1/search" && u.searchParams.get("q") === "track:Quimbara artist:Celia Cruz",
        () => json({ tracks: { items: [raw("c1", "Quimbara", "celia", "Celia Cruz"), raw("c2", "Quimbara - Live", "celia", "Celia Cruz")] } }),
      ),
      route((u) => u.pathname === "/v1/search" && (u.searchParams.get("q") ?? "").includes("Compay"), () => json({ error: "boom" }, 500)),
      route((u) => u.pathname === "/v1/search" && (u.searchParams.get("q") ?? "").startsWith("track:"), () => json({ tracks: { items: [] } })),
      route(
        (u) => u.pathname === "/v1/search" && u.searchParams.get("q") === "Quimbara",
        () => json({ tracks: { items: [raw("s1", "Quimbara - Live at Gran Teatro Nacional", "succar", "Tony Succar"), raw("c2", "Quimbara - Live", "celia", "Celia Cruz"), raw("x1", "Quimbara", "band", "Salsa Band")] } }),
      ),
    ]);
    const result = await findTracks("Quimbara", "AU", LIVE, ["Celia Cruz", "Buena Vista Social Club", "Compay Segundo", "Omara Portuondo"]);
    expect(result.mode).toBe("live");
    // Celia Cruz first (plain-search order, then the scoped extras), then the rest in Spotify's order; a failed scoped query is skipped.
    expect(result.data.map((t) => t.id)).toEqual(["c2", "c1", "s1", "x1"]);
    const queries = calls.filter((c) => c.url.pathname === "/v1/search").map((c) => c.url.searchParams.get("q"));
    expect(queries.filter((q) => q?.startsWith("track:"))).toHaveLength(3);
    expect(queries).not.toContain("track:Quimbara artist:Omara Portuondo");
    expect(calls.find((c) => c.url.searchParams.get("q") === "track:Quimbara artist:Celia Cruz")!.url.searchParams.get("limit")).toBe("5");

    // Offline: the synthetic scoped result by a catalogue artist comes first.
    const offline = await findTracks("Gravy", "AU", OFFLINE, ["Paul Kelly"]);
    expect(offline.data[0]).toMatchObject({ title: "Gravy", artists: [{ name: "Paul Kelly", id: expect.stringMatching(/^[A-Za-z0-9]{22}$/) }] });
    expect(offline.data).toHaveLength(4);
  });

  it("answers an artist search without waiting on release counts", async () => {
    const { findArtists } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname === "/v1/search", () => json(SYNTHETIC_RAW.search)),
      // A release-count call would hang forever; the search must not make or await it.
      route((u) => u.pathname.endsWith("/albums"), () => new Promise<Response>(() => {})),
    ]);
    const result = await findArtists("synthetic", "AU", LIVE);
    expect(result.mode).toBe("live");
    expect(result.data.every((a) => a.releases === null)).toBe(true);
    expect(calls.filter((c) => c.url.pathname.endsWith("/albums"))).toHaveLength(0);
  });

  it("loads release counts lazily per id, failures unknown", async () => {
    const { findReleaseCounts, MAX_RELEASE_IDS } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname === "/v1/artists/a1/albums", () => json(SYNTHETIC_RAW.albumsTotal.a1)),
      route((u) => u.pathname.endsWith("/albums"), () => json({ error: { status: 500 } }, 500)),
    ]);
    const result = await findReleaseCounts(["a1", "a2", "a1", " "], "AU", LIVE);
    expect(result).toMatchObject({ mode: "live", data: { a1: 27 } });
    expect(result.data).not.toHaveProperty("a2");
    const count = calls.find((c) => c.url.pathname === "/v1/artists/a1/albums")!;
    expect(Object.fromEntries(count.url.searchParams)).toEqual({ include_groups: "album,single", limit: "1", market: "AU" });

    mockFetch([tokenRoute, route(() => true, () => json({}, 500))]);
    expect(await findReleaseCounts(["x"], "AU", LIVE)).toMatchObject({ mode: "fallback", data: {} });

    const many = mockFetch([tokenRoute, route(() => true, () => json({ total: 1 }))]);
    await findReleaseCounts(Array.from({ length: 15 }, (_, i) => `id${i}`), "AU", LIVE);
    expect(many.calls.filter((c) => c.url.pathname.endsWith("/albums"))).toHaveLength(MAX_RELEASE_IDS);

    const offline = await findReleaseCounts([syntheticSpotifyId("x")], "AU", OFFLINE);
    expect(offline.mode).toBe("synthetic");
    expect(offline.data[syntheticSpotifyId("x")]).toBeGreaterThan(0);
  });

  it("picks a cover near 64 px, else the only one", async () => {
    const { pickImage } = await import("@/server/adapters/repertoire/schema");
    expect(pickImage(undefined)).toBeNull();
    expect(pickImage([])).toBeNull();
    expect(pickImage([{ url: "https://x.test/a", width: null }])).toBe("https://x.test/a");
    expect(pickImage([{ url: "https://x.test/big", width: 640 }, { url: "https://x.test/small", width: 32 }])).toBe("https://x.test/big");
  });

  it("loads an artist's catalogue across pages and deduplicates titles", async () => {
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname.endsWith("/albums") && u.searchParams.get("offset") === "10", () => json(SYNTHETIC_RAW.albumsPage2)),
      route((u) => u.pathname.endsWith("/albums"), () => json(SYNTHETIC_RAW.albumsPage1)),
      route((u) => u.pathname.startsWith("/v1/albums/"), (u) => json(SYNTHETIC_RAW.tracks[u.pathname.split("/")[3] as "al1"])),
    ]);
    const result = await getArtistCatalogue("https://open.spotify.com/artist/0SNWoGaDlrCompmg9rXeNq", "AU", LIVE);
    expect(result.mode).toBe("live");
    expect(result.data.map((t) => t.title)).toEqual(["Synthetic Original", "Second Song", "Third Song"]);
    expect(result.data[0]).toMatchObject({ album: "Synthetic LP", image: "https://i.scdn.co/image/syn-lp", durationMs: 181_000 });
    expect(result.data[1].durationMs).toBeNull();
    expect(calls.some((c) => c.url.pathname.includes("top-tracks"))).toBe(false);
  });

  it("pages through a whole catalogue: 80 albums over 8 pages, no 3-page or 15-album cap", async () => {
    const { getArtistCatalogue } = await fresh();
    const page = (n: number) => json({
      items: Array.from({ length: 10 }, (_, i) => ({ id: `al${n * 10 + i}`, name: `Album ${n * 10 + i}`, album_type: "album" })),
      next: n < 7 ? `https://api.spotify.com/v1/artists/0SNWoGaDlrCompmg9rXeNq/albums?offset=${(n + 1) * 10}&limit=10` : null,
    });
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname.endsWith("/albums"), (u) => page(Number(u.searchParams.get("offset") ?? 0) / 10)),
      route((u) => u.pathname.startsWith("/v1/albums/"), (u) => {
        const id = u.pathname.split("/")[3];
        return json({ items: [{ id: `t-${id}`, name: `Song of ${id}`, artists: [{ id: "a1", name: "Synthetic Artist" }] }], next: null });
      }),
    ]);
    const result = await getArtistCatalogue("https://open.spotify.com/artist/0SNWoGaDlrCompmg9rXeNq", "AU", LIVE);
    expect(result.data).toHaveLength(80);
    expect(calls.filter((c) => c.url.pathname.endsWith("/albums"))).toHaveLength(8);
    expect(calls.filter((c) => c.url.pathname.startsWith("/v1/albums/"))).toHaveLength(80);
  });

  it("follows an album's track list past one page of 50", async () => {
    const { getArtistCatalogue } = await fresh();
    const track = (i: number) => ({ id: `t${i}`, name: `Track ${i}`, artists: [{ id: "a1", name: "Synthetic Artist" }] });
    mockFetch([
      tokenRoute,
      route((u) => u.pathname.endsWith("/albums"), () => json({ items: [{ id: "big", name: "Big", album_type: "album" }], next: null })),
      route((u) => u.pathname === "/v1/albums/big/tracks" && u.searchParams.get("offset") === "50", () => json({ items: Array.from({ length: 20 }, (_, i) => track(50 + i)), next: null })),
      route((u) => u.pathname === "/v1/albums/big/tracks", () => json({ items: Array.from({ length: 50 }, (_, i) => track(i)), next: "https://api.spotify.com/v1/albums/big/tracks?offset=50&limit=50" })),
    ]);
    const result = await getArtistCatalogue("https://open.spotify.com/artist/0SNWoGaDlrCompmg9rXeNq", "AU", LIVE);
    expect(result.data).toHaveLength(70);
  });

  it("rides out a Spotify 429 on an album: waits, retries, and keeps the whole catalogue (18 Oct live run)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const { getArtistCatalogue } = await fresh();
      let hits = 0;
      mockFetch([
        tokenRoute,
        route((u) => u.pathname.endsWith("/albums"), () => json({ items: ["a", "b", "c"].map((id) => ({ id, name: `Album ${id}`, album_type: "album" })), next: null })),
        route((u) => u.pathname === "/v1/albums/b/tracks" && hits++ === 0, () => json({}, 429)),
        route((u) => u.pathname.startsWith("/v1/albums/"), (u) => json({ items: [{ id: `t-${u.pathname.split("/")[3]}`, name: `Song ${u.pathname.split("/")[3]}`, artists: [{ id: "a1", name: "Synthetic Artist" }] }], next: null })),
      ]);
      const pending = getArtistCatalogue("https://open.spotify.com/artist/0SNWoGaDlrCompmg9rXeNq", "AU", LIVE);
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.mode).not.toBe("fallback");
      expect(result.data.map((t) => t.title).sort()).toEqual(["Song a", "Song b", "Song c"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns nothing for an unrecognised link", async () => {
    const { getArtistCatalogue } = await fresh();
    const { calls } = mockFetch([]);
    const result = await getArtistCatalogue("not a link", "AU", LIVE);
    expect(result).toMatchObject({ mode: "live", data: [] });
    expect(calls).toHaveLength(0);
  });

  it("falls back when the token request fails or credentials are missing", async () => {
    const { findTracks } = await fresh();
    mockFetch([route(() => true, () => json({ error: "invalid_client" }, 400))]);
    expect(await findTracks("x", "AU", LIVE)).toMatchObject({ mode: "fallback", reason: "http", data: [] });

    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "SET_ME");
    const again = await fresh();
    expect(await again.findTracks("x", "AU", LIVE)).toMatchObject({ mode: "fallback", reason: "missing_key" });
  });

  it("is synthetic offline", async () => {
    const { findTracks, findArtists, getArtistCatalogue } = await fresh();
    expect((await findTracks("x", "AU", OFFLINE)).mode).toBe("synthetic");
    // An unknown name gets a made-up artist whose id passes spotifyIdSchema, the same on every search (B-003).
    const [made] = (await findArtists("zzq", "AU", OFFLINE)).data;
    expect(made).toEqual({ id: syntheticSpotifyId("zzq (synthetic)"), name: "zzq (synthetic)", image: null, releases: null, url: null });
    expect(spotifyIdSchema.safeParse(made.id).success).toBe(true);
    expect((await findArtists("ZZQ ", "AU", OFFLINE)).data[0].id).toBe(made.id);
    expect((await findArtists("zzr", "AU", OFFLINE)).data[0].id).not.toBe(made.id);
    for (const track of (await findTracks("x", "AU", OFFLINE)).data) expect(spotifyIdSchema.safeParse(track.artists[0].id).success).toBe(true);
    // Offline artists come from the Qloo mock's catalogue, with its Spotify-shaped ids.
    const paul = (await findArtists("paul ke", "AU", OFFLINE)).data;
    expect(paul[0]).toMatchObject({ name: "Paul Kelly", id: expect.stringMatching(/^[A-Za-z0-9]{22}$/) });
    expect((await getArtistCatalogue("nope", "AU", OFFLINE)).data).toHaveLength(4);
    expect(spotifyIdSchema.safeParse(syntheticScopedTrackSearch("Song", "Qa Nobody Band")[0].artists[0].id).success).toBe(true);
  });

  it("reads release years from Spotify dates", async () => {
    const { releaseYear } = await import("@/server/adapters/repertoire/schema");
    expect(releaseYear("1972-10-24")).toBe(1972);
    expect(releaseYear("1972-10")).toBe(1972);
    expect(releaseYear("1972")).toBe(1972);
    expect(releaseYear("0000")).toBeNull();
    expect(releaseYear(undefined)).toBeNull();
  });

  it("finds each song's first release year: same artist and title, earliest album", async () => {
    const { findReleaseYears } = await fresh();
    const track = (name: string, artist: string, date: string | undefined) => ({ id: name + date, name, artists: [{ id: "x", name: artist }], album: { name: "A", images: [], ...(date ? { release_date: date } : {}) } });
    const { calls } = mockFetch([
      tokenRoute,
      route(
        (u) => u.pathname === "/v1/search" && (u.searchParams.get("q") ?? "").includes("Superstition"),
        () => json({ tracks: { items: [track("Superstition - Remastered", "Stevie Wonder", "2000-01-01"), track("Superstition", "Stevie Wonder", "1972-10-24"), track("Superstition", "A Cover Band", "1965"), track("Superstition", "Stevie Wonder", undefined), null] } }),
      ),
      route((u) => u.pathname === "/v1/search" && (u.searchParams.get("q") ?? "").includes("Nobody"), () => json({ tracks: { items: [] } })),
      route((u) => u.pathname === "/v1/search", () => json({ error: "boom" }, 500)),
    ]);
    const result = await findReleaseYears(
      [
        { title: "Superstition", artist: "Stevie Wonder" },
        { title: "superstition", artist: "stevie wonder" },
        { title: "Nobody", artist: "Someone" },
        { title: "Broken", artist: "Errors" },
      ],
      "AU",
      LIVE,
    );
    expect(result.mode).toBe("live");
    expect(result.data).toEqual({ "stevie wonder|superstition": 1972 });
    expect(calls.find((c) => c.url.searchParams.get("q") === "track:Superstition artist:Stevie Wonder")).toBeDefined();
  });

  it("falls back to no years when every lookup fails, and invents stable years offline", async () => {
    const { findReleaseYears } = await fresh();
    mockFetch([tokenRoute, route((u) => u.pathname === "/v1/search", () => json({ error: "boom" }, 500))]);
    const failed = await findReleaseYears([{ title: "A", artist: "B" }], "AU", LIVE);
    expect(failed).toMatchObject({ mode: "fallback", data: {} });
    const offline = await findReleaseYears([{ title: "A", artist: "B" }], "AU", OFFLINE);
    expect(offline.mode).toBe("synthetic");
    expect(offline.data["b|a"]).toBeGreaterThanOrEqual(1965);
    expect((await findReleaseYears([{ title: "A", artist: "B" }], "AU", OFFLINE)).data).toEqual(offline.data);
  });
});

describe("repertoire: an artist's songs (the learn run's top_tracks)", () => {
  beforeEach(() => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "synthetic-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "synthetic-secret");
  });

  const item = (id: string, name: string, artist: string) => ({ id, name, artists: [{ id: `a-${artist}`, name: artist }], duration_ms: 200_000, album: { name: "Album", release_date: "2001-05-01", images: [] } });

  it("asks Spotify for the artist's tracks, keeps only that artist's (no namesakes) and collapses repeated editions", async () => {
    const { findArtistTracks } = await fresh();
    const { calls } = mockFetch([
      tokenRoute,
      route((u) => u.pathname === "/v1/search", () =>
        json({ tracks: { items: [item("t1", "Orphan Girl", "Gillian Welch"), item("t2", "Orphan Girl - Remastered", "Gillian Welch"), item("t3", "Other Song", "Gillian Welch Tribute"), item("t4", "Elvis Presley Blues", "Gillian Welch"), null] } }),
      ),
    ]);
    const result = await findArtistTracks("Gillian Welch", "AU", LIVE);
    const search = calls.find((c) => c.url.pathname === "/v1/search")!;
    expect(search.url.searchParams.get("q")).toBe('artist:"Gillian Welch"');
    expect(search.url.searchParams.get("type")).toBe("track");
    expect(search.url.searchParams.get("market")).toBe("AU");
    expect(result.mode).toBe("live");
    expect(result.data.map((t) => [t.id, t.title, t.year])).toEqual([["t1", "Orphan Girl", 2001], ["t4", "Elvis Presley Blues", 2001]]);
  });

  it("falls back to an empty list when Spotify fails (the run then asks Last.fm), and is synthetic offline", async () => {
    const { findArtistTracks } = await fresh();
    mockFetch([tokenRoute, route((u) => u.pathname === "/v1/search", () => json({}, 500))]);
    expect((await findArtistTracks("X", "AU", LIVE)).data).toEqual([]);
    const offline = await findArtistTracks("Paul Kelly", "AU", OFFLINE);
    expect(offline.mode).toBe("synthetic");
    expect(offline.data).toHaveLength(6);
    expect(offline.data.every((t) => spotifyIdSchema.safeParse(t.id).success)).toBe(true);
  });
});
