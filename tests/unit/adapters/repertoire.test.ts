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
    const { calls } = mockFetch([tokenRoute, route((u) => u.pathname === "/v1/search", () => json(SYNTHETIC_RAW.search))]);
    const tracks = await findTracks("synthetic", "AU", LIVE);
    const artists = await findArtists("synthetic", "AU", LIVE);
    expect(tracks.data).toEqual([
      { id: "t1", title: "Synthetic Track", artists: [{ id: "a1", name: "Synthetic Artist" }], album: "Synthetic Album", url: "https://open.spotify.com/track/t1" },
    ]);
    expect(artists.data).toEqual([{ id: "a1", name: "Synthetic Artist", url: "https://open.spotify.com/artist/a1" }]);
    // One token for both calls; search limit respects Spotify's cap of 10.
    expect(calls.filter((c) => c.url.host === "accounts.spotify.com")).toHaveLength(1);
    const search = calls.find((c) => c.url.pathname === "/v1/search")!;
    expect(search.url.searchParams.get("limit")).toBe("10");
    expect((search.init?.headers as Record<string, string>).Authorization).toBe("Bearer synthetic-token");
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
    expect(result.data[0].album).toBe("Synthetic LP");
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
    expect((await findArtists("x", "AU", OFFLINE)).data).toHaveLength(1);
    expect((await getArtistCatalogue("nope", "AU", OFFLINE)).data).toHaveLength(4);
  });
});
