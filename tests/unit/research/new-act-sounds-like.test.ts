import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two acts Qloo doesn't know, researched one after the other on the same Repertoire: the Hive's sound-alikes for the second
 * act replace the first act's, never merge with them (they would sit under the second act's NotOnQ or Qloo labels).
 */
const FIRST = "1aaaaaaaaaaaaaaaaaaaaa";
const SECOND = "2bbbbbbbbbbbbbbbbbbbbb";
const NAMES: Record<string, string> = { [FIRST]: "Nobody Duo One", [SECOND]: "Nobody Duo Two" };
const SIMILAR: Record<string, string[]> = { "Nobody Duo One": ["Paul Kelly", "Courtney Barnett"], "Nobody Duo Two": ["Stevie Wonder", "Amy Winehouse"] };

vi.mock("@/server/adapters/repertoire", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/repertoire")>();
  return {
    ...original,
    getArtistProfile: async (id: string) => ({ mode: "live" as const, data: { name: NAMES[id], images: [], genres: [], fetchedAt: new Date().toISOString() } }),
    getArtistCatalogue: async () => ({ mode: "fallback" as const, data: [] }),
  };
});
vi.mock("@/server/adapters/songs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/songs")>();
  return {
    ...original,
    getSimilarArtists: async (name: string) => ({ mode: "live" as const, data: (SIMILAR[name] ?? []).map((n) => ({ name: n, match: 0.9 })) }),
    getTopTags: async () => ({ mode: "live" as const, data: [{ name: "indie folk", count: 100 }] }),
  };
});

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => vi.unstubAllEnvs());

async function boot() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  return { research: await import("@/app/api/playlist/research/route"), playlist: await import("@/app/api/playlist/route") };
}

describe("a different act's link", () => {
  it("replaces the Hive's sound-alikes with the new act's", async () => {
    const { research, playlist } = await boot();
    const first = await research.POST(req("POST", "/research", { link: FIRST }));
    const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
    await first.text();
    const names = async () => ((await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist.soundsLike as { name: string }[]).map((a) => a.name);
    expect(await names()).toEqual(SIMILAR["Nobody Duo One"]);
    await (await research.POST(req("POST", "/research", { link: SECOND }, cookie))).text();
    expect(await names()).toEqual(SIMILAR["Nobody Duo Two"]);
  });

  it("keeps a sound-alike the user picked, and then adds no Hive ones", async () => {
    const { research, playlist } = await boot();
    const first = await research.POST(req("POST", "/research", { link: FIRST }));
    const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
    await first.text();
    const current = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    await playlist.PATCH(req("PATCH", "", { revision: current.revision, soundsLike: [{ name: "My Pick" }] }, cookie));
    await (await research.POST(req("POST", "/research", { link: SECOND }, cookie))).text();
    const view = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect((view.soundsLike as { name: string }[]).map((a) => a.name)).toEqual(["My Pick"]);
  });
});
