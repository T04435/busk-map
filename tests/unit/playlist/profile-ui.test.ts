import { beforeEach, describe, expect, it, vi } from "vitest";
import { profilePhoto } from "@/components/playlist/profile-header";
import { artistSource } from "@/components/landing/artist-picker";
import { withSuggested } from "@/components/playlist/sounds-like-suggestions";
import { CATALOG } from "@/server/qloo-mock/catalog";
import { json, LIVE, mockFetch, OFFLINE, route } from "../../helpers";

const KNOWN = CATALOG[0];
const UNKNOWN_ID = "4gzpq5DPGxSnKTe4SA8HAU";

async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  const store = await import("@/server/playlist/store");
  store.resetPlaylistStoresForTests();
  return { root: await import("@/app/api/playlist/route"), profile: await import("@/app/api/playlist/profile/route"), soundsLike: await import("@/app/api/playlist/sounds-like/route") };
}
const req = (path: string, method: string, body?: unknown, cookie?: string) =>
  new Request(`http://localhost:3100${path}`, {
    method,
    headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

describe("Spotify profile and Qloo sounds-like on the Repertoire (offline)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("loads the profile for a catalogue artist, finds it in Qloo and suggests other artists, never itself", async () => {
    const { root, profile, soundsLike } = await load();
    const cookie = cookieOf(await root.POST(req("/api/playlist", "POST", { spotifyArtistId: KNOWN.spotifyId })));
    // Nothing is loaded by merely having the link.
    const before = (await (await root.GET(req("/api/playlist", "GET", undefined, cookie))).json()).playlist;
    expect(before).toMatchObject({ spotifyProfile: null, qlooArtistId: null });
    expect(await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET", undefined, cookie))).json()).toEqual({ status: "not_loaded", artists: [] });

    const res = await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ spotify: "ok", qloo: "matched" });
    expect(body.playlist.spotifyProfile).toMatchObject({ name: KNOWN.name, images: [] });
    expect(body.playlist.spotifyProfile.genres.length).toBeGreaterThan(0);
    expect(body.playlist.qlooArtistId).toBe(KNOWN.id);

    const sounds = await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET", undefined, cookie))).json();
    expect(sounds.status).toBe("ok");
    expect(sounds.artists.length).toBeGreaterThan(0);
    expect(sounds.artists.length).toBeLessThanOrEqual(10);
    // Every suggestion carries its Qloo id and the Spotify id from Qloo's external ids (the mock sends them), so none shows as typed.
    for (const a of sounds.artists) expect(a).toMatchObject({ qlooId: expect.any(String), spotifyId: expect.stringMatching(/^[A-Za-z0-9]{22}$/) });
    expect(sounds.artists.map((a: { name: string }) => a.name)).not.toContain(KNOWN.name);
    // The user's own picks are never touched.
    expect(body.playlist.soundsLike).toEqual([]);
  });

  it("Qloo not knowing the artist: profile saved, qlooArtistId null, one 'unknown_artist' answer and no suggestions", async () => {
    const { root, profile, soundsLike } = await load();
    const cookie = cookieOf(await root.POST(req("/api/playlist", "POST", { spotifyArtistId: UNKNOWN_ID })));
    const body = await (await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie))).json();
    expect(body).toMatchObject({ spotify: "ok", qloo: "unknown" });
    expect(body.playlist).toMatchObject({ qlooArtistId: null, spotifyProfile: { name: "Synthetic Performer" } });
    expect(await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET", undefined, cookie))).json()).toEqual({ status: "unknown_artist", artists: [] });
  });

  it("clearing the link clears the profile; no link and no Repertoire are told apart", async () => {
    const { root, profile, soundsLike } = await load();
    const cookie = cookieOf(await root.POST(req("/api/playlist", "POST", { spotifyArtistId: KNOWN.spotifyId })));
    await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie));
    const got = (await (await root.GET(req("/api/playlist", "GET", undefined, cookie))).json()).playlist;
    await root.PATCH(req("/api/playlist", "PATCH", { revision: got.revision, spotifyArtistId: null }, cookie));
    const cleared = await (await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie))).json();
    expect(cleared).toMatchObject({ spotify: "no_link", qloo: "skipped" });
    expect(cleared.playlist).toMatchObject({ spotifyArtistId: null, spotifyProfile: null, qlooArtistId: null });
    expect((await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET", undefined, cookie))).json()).status).toBe("no_artist");
    expect(await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET"))).json()).toEqual({ status: "no_playlist", artists: [] });
    expect((await profile.POST(req("/api/playlist/profile", "POST"))).status).toBe(404);
  });

  it("refreshing replaces the snapshot, and keeps it when Spotify does not answer", async () => {
    const { root, profile } = await load();
    const cookie = cookieOf(await root.POST(req("/api/playlist", "POST", { spotifyArtistId: KNOWN.spotifyId })));
    const first = (await (await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie))).json()).playlist;
    await new Promise((r) => setTimeout(r, 5));
    const second = (await (await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie))).json()).playlist;
    expect(second.spotifyProfile.fetchedAt).not.toBe(first.spotifyProfile.fetchedAt);
    expect(second.revision).toBeGreaterThan(first.revision);
  });
});

describe("getArtistProfile (live shape)", () => {
  beforeEach(() => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "synthetic-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "synthetic-secret");
  });

  it("reads name, photos, genres and followers from GET /v1/artists/{id}; a 404 falls back to null", async () => {
    vi.resetModules();
    const { getArtistProfile } = await import("@/server/adapters/repertoire");
    const { calls } = mockFetch([
      route((u) => u.host === "accounts.spotify.com", () => json({ access_token: "synthetic-token", token_type: "Bearer", expires_in: 3600 })),
      route((u) => u.pathname === "/v1/artists/syn1", () =>
        json({ id: "syn1", name: "Synthetic Performer", genres: ["synthetic folk"], followers: { total: 1234 }, images: [{ url: "https://i.scdn.co/image/syn-640", width: 640, height: 640 }] }),
      ),
      route((u) => u.pathname === "/v1/artists/missing", () => json({ error: { status: 404, message: "Not found" } }, 404)),
    ]);
    const ok = await getArtistProfile("syn1", LIVE);
    expect(ok.mode).toBe("live");
    expect(ok.data).toMatchObject({ name: "Synthetic Performer", genres: ["synthetic folk"], followers: 1234, images: [{ url: "https://i.scdn.co/image/syn-640", width: 640 }] });
    expect(calls.some((c) => c.url.pathname.includes("related-artists") || c.url.pathname.includes("recommendations") || c.url.pathname.includes("audio-features"))).toBe(false);
    const missing = await getArtistProfile("missing", LIVE);
    expect(missing.data).toBeNull();
    expect(missing.mode).toBe("fallback");
    expect((await getArtistProfile("syn1", OFFLINE)).mode).toBe("synthetic");
  });
});

describe("profile pieces", () => {
  it("picks a photo of at least 160 px, falls back to the first, ignores non-https", () => {
    expect(profilePhoto([{ url: "https://i/640", width: 640 }, { url: "https://i/300", width: 300 }, { url: "https://i/64", width: 64 }])).toBe("https://i/300");
    expect(profilePhoto([{ url: "https://i/64", width: 64 }])).toBe("https://i/64");
    expect(profilePhoto([{ url: "javascript:alert(1)", width: 640 }])).toBeNull();
    expect(profilePhoto([])).toBeNull();
  });

  it("adding suggestions keeps the picks, skips duplicates and stops at ten", () => {
    const picks = [{ name: "Paul Kelly", spotifyId: "x", image: null }];
    const added = withSuggested(picks, [{ name: "paul kelly" }, { name: "Courtney Barnett" }]);
    expect(added.map((a) => a.name)).toEqual(["Paul Kelly", "Courtney Barnett"]);
    expect(added[0].spotifyId).toBe("x");
    const kept = withSuggested([], [{ name: "50 Cent", qlooId: "q1", spotifyId: "s".repeat(22) }, { name: "No Spotify", qlooId: "q2" }]);
    expect(kept[0]).toMatchObject({ spotifyId: "s".repeat(22), qlooId: "q1" });
    expect(kept[1]).toMatchObject({ spotifyId: null, qlooId: "q2" });
    expect(artistSource(kept[0])).toBe("spotify");
    expect(artistSource(kept[1])).toBe("qloo");
    expect(artistSource({ spotifyId: null })).toBe("typed");
    const many = withSuggested([], Array.from({ length: 14 }, (_, i) => ({ name: `A${i}` })));
    expect(many).toHaveLength(10);
  });
});
