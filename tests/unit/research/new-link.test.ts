import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueTrack } from "@/server/adapters/repertoire/schema";
import { CATALOG } from "@/server/qloo-mock/catalog";

/** U31/U32/U33: a new Spotify link renames the act, labels songs with their real artist, and sound-alikes keep their photos. */
const [A, B] = CATALOG.filter((a) => a.spotifyId);
const NAMES: Record<string, string> = { [A.spotifyId]: "El B", [B.spotifyId]: "Al2 El Aldeano" };
const track = (i: number, artists: { id: string; name: string }[]): CatalogueTrack => ({ id: `tid${String(i).padStart(19, "0")}xyz`.slice(0, 22), title: `Song ${i}`, artists, album: "LP", image: null, durationMs: 200_000, url: null, year: 2020 });
let spotifyDown = false;

vi.mock("@/server/adapters/repertoire", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/repertoire")>();
  return {
    ...original,
    getArtistProfile: async (id: string) => ({ mode: "live" as const, data: { name: NAMES[id], images: [{ url: `https://img.test/${id}.jpg`, width: 320 }], genres: ["hip hop"], fetchedAt: new Date().toISOString() } }),
    getArtistCatalogue: async (id: string) =>
      spotifyDown
        ? { mode: "fallback" as const, data: [] }
        : {
            mode: "live" as const,
            // Solo song by the linked artist, a duet with a namesake first, and a track by someone else only.
            data: [track(1, [{ id, name: NAMES[id] }]), track(2, [{ id: "other", name: "Guest" }, { id, name: NAMES[id] }]), track(3, [{ id: "x", name: "Somebody Else" }])],
          },
  };
});

// The Qloo mock has no photos: give the sound-alikes one, as live Qloo does.
vi.mock("@/server/playlist/own-artist", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/playlist/own-artist")>();
  return {
    ...original,
    soundsLikeFor: async (...args: Parameters<typeof original.soundsLikeFor>) => {
      const res = await original.soundsLikeFor(...args);
      return { ...res, artists: res.artists.map((a) => ({ ...a, image: `https://img.test/q/${a.qlooId}.jpg` })) };
    },
  };
});

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  vi.unstubAllEnvs();
  spotifyDown = false;
});

async function boot() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  return { research: await import("@/app/api/playlist/research/route"), playlist: await import("@/app/api/playlist/route") };
}
const link = (id: string) => ({ link: id });

describe("a new Spotify link", () => {
  it("renames the auto-filled act, labels each song with its Spotify artist, and keeps the previous act's songs as they were", async () => {
    const { research, playlist } = await boot();
    const first = await research.POST(req("POST", "/research", link(A.spotifyId)));
    const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
    await first.text();
    let view = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.actName).toBe("El B");
    // U33: every saved sound-alike keeps its Qloo photo.
    expect(view.soundsLike.length).toBeGreaterThan(0);
    for (const a of view.soundsLike) expect(a.image, a.name).toMatch(/^https:\/\//);

    const second = await research.POST(req("POST", "/research", link(B.spotifyId), cookie));
    const text = await second.text();
    view = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.actName).toBe("Al2 El Aldeano");
    // U32: the run is about the new act (the paragraph that named it is retired).
    expect(text).toContain("Al2 El Aldeano");
    const by = (title: string) => view.songs.filter((s: { title: string }) => s.title === title);
    const artists = (view.songs as { title: string; artist: string }[]).map((s) => `${s.title}|${s.artist}`);
    expect(artists).toContain("Song 1|El B"); // the previous link's own song stays, not relabelled
    expect(artists).toContain("Song 1|Al2 El Aldeano");
    expect(artists).toContain("Song 2|Al2 El Aldeano"); // the linked artist, matched by id, not the guest first on the track
    expect(artists).toContain("Song 3|Somebody Else"); // a track without the linked artist: its own artist, never the act name
    expect(by("Song 3")[0].artist).not.toBe("Al2 El Aldeano");
  });

  it("keeps an act name the user typed", async () => {
    const { research, playlist } = await boot();
    const first = await research.POST(req("POST", "/research", link(A.spotifyId)));
    const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
    await first.text();
    const current = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    await playlist.PATCH(req("PATCH", "", { revision: current.revision, actName: "Los Dos" }, cookie));
    await (await research.POST(req("POST", "/research", link(B.spotifyId), cookie))).text();
    const view = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.actName).toBe("Los Dos");
  });

  it("says plainly that Spotify isn't answering when the songs come from Last.fm", async () => {
    const { research } = await boot();
    spotifyDown = true;
    const text = await (await research.POST(req("POST", "/research", link(A.spotifyId)))).text();
    expect(text).toMatch(/Spotify (isn't answering right now|didn't answer)/);
  });
});

describe("pure helpers", () => {
  it("actNameFollowsProfile: empty or the previous profile's name follows; a typed name does not", async () => {
    const { actNameFollowsProfile } = await import("@/server/research/run");
    expect(actNameFollowsProfile(null, undefined)).toBe(true);
    expect(actNameFollowsProfile("El B", "el b")).toBe(true);
    expect(actNameFollowsProfile("Los Dos", "El B")).toBe(false);
    expect(actNameFollowsProfile("Los Dos", null)).toBe(false);
  });

  it("trackArtist: the linked artist by id, else the track's first artist, else the profile name", async () => {
    const { trackArtist } = await import("@/server/research/run");
    expect(trackArtist([{ id: "g", name: "Guest" }, { id: "me", name: "Me (Spotify)" }], "me", "Me")).toEqual({ name: "Me", isOwn: true });
    expect(trackArtist([{ id: "g", name: " Guest " }], "me", "Me")).toEqual({ name: "Guest", isOwn: false });
    expect(trackArtist([], "me", "Me")).toEqual({ name: "Me", isOwn: true });
  });

  it("fillSoundsLikeImages: fills only the photos that are missing, by name, https only", async () => {
    const { fillSoundsLikeImages } = await import("@/server/research/run");
    const list = [{ name: "Morodo", qlooId: "q1" }, { name: "Has", image: "https://a.test/keep.jpg" }, { name: "Nope" }];
    const out = fillSoundsLikeImages(list, [{ name: "morodo", image: "https://a.test/m.jpg" }, { name: "Has", image: "https://a.test/other.jpg" }, { name: "Nope", image: "http://insecure.test/x.jpg" }]);
    expect(out).toEqual([{ name: "Morodo", qlooId: "q1", image: "https://a.test/m.jpg" }, { name: "Has", image: "https://a.test/keep.jpg" }, { name: "Nope" }]);
    expect(fillSoundsLikeImages(list, [])).toBeNull();
  });
});
