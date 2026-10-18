import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueTrack } from "@/server/adapters/repertoire/schema";
import { CATALOG } from "@/server/qloo-mock/catalog";

/** U16: a research run adds ALL of the act's own songs to Songs you can sing (it stopped at 20 and at a 60-song Repertoire). */
const JULIA = CATALOG.find((a) => a.name === "Julia Jacklin")!;
const TRACKS = 150;
vi.mock("@/server/adapters/repertoire", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/repertoire")>();
  return {
    ...original,
    getArtistCatalogue: async () => ({
      mode: "live" as const,
      data: Array.from({ length: TRACKS }, (_, i): CatalogueTrack => ({ id: `tid${String(i).padStart(19, "0")}xyz`.slice(0, 22), title: `Own Song ${i}`, artists: [{ id: JULIA.spotifyId, name: "Julia Jacklin" }], album: "LP", image: null, durationMs: 200_000, url: null, year: 2020 })),
    }),
  };
});

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => vi.unstubAllEnvs());

describe("research step 2 with a long catalogue", () => {
  it("adds every one of the act's own songs and never reports a full Repertoire", async () => {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
    (await import("@/server/learn/store")).resetLearnStoresForTests();
    (await import("@/server/learn/runs")).clearLearnRunsForTests();
    const research = await import("@/app/api/playlist/research/route");
    const playlist = await import("@/app/api/playlist/route");
    const res = await research.POST(req("POST", "/research", { link: `https://open.spotify.com/artist/${JULIA.spotifyId}` }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const text = await res.text();
    expect(text).not.toMatch(/is full/);
    expect(text).toContain(`Added ${TRACKS} of your songs`);
    const view = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.songs.filter((s: { own: boolean }) => s.own)).toHaveLength(TRACKS);
    expect(view).not.toHaveProperty("maxSongs");
  });
});
