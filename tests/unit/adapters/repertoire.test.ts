import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYNTHETIC_RAW } from "@/server/adapters/repertoire/fixtures/synthetic";
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

    const offline = await findReleaseCounts(["syn-artist-1"], "AU", OFFLINE);
    expect(offline.mode).toBe("synthetic");
    expect(offline.data["syn-artist-1"]).toBeGreaterThan(0);
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
    expect((await findArtists("zzq", "AU", OFFLINE)).data).toEqual([{ id: "syn-artist-1", name: "zzq (synthetic)", image: null, releases: null, url: null }]);
    // Offline artists come from the Qloo mock's catalogue, with its Spotify-shaped ids.
    const paul = (await findArtists("paul ke", "AU", OFFLINE)).data;
    expect(paul[0]).toMatchObject({ name: "Paul Kelly", id: expect.stringMatching(/^[A-Za-z0-9]{22}$/) });
    expect((await getArtistCatalogue("nope", "AU", OFFLINE)).data).toHaveLength(4);
  });
});
