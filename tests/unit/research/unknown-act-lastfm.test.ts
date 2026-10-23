import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchSnapshot } from "@/lib/repertoire-research";

/**
 * An act Qloo doesn't know (Al2 El Aldeano): the Hive asks Last.fm for similar artists under the act's Spotify name, and those
 * are "who you sound like" and are saved as the Repertoire's "Artists you sound like", even when Qloo confirms none of them.
 */
const SPOTIFY_ID = "6zYGkCfNmXiKyyHTbNgYcW";
const SIMILAR = ["Calle 13", "Los Aldeanos", "El B", "Silvito El Libre"];
const asked = vi.hoisted(() => [] as string[]);

vi.mock("@/server/adapters/repertoire", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/repertoire")>();
  return {
    ...original,
    getArtistProfile: async () => ({ mode: "live" as const, data: { name: "Al2 El Aldeano", images: [], genres: [], fetchedAt: new Date().toISOString() } }),
    getArtistCatalogue: async () => ({ mode: "fallback" as const, data: [] }),
  };
});
vi.mock("@/server/adapters/songs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/songs")>();
  return {
    ...original,
    getSimilarArtists: async (name: string) => {
      asked.push(name);
      return { mode: "live" as const, data: name === "Al2 El Aldeano" ? SIMILAR.map((n) => ({ name: n, match: 0.9 })) : [] };
    },
    getTopTags: async () => ({ mode: "live" as const, data: [{ name: "indie folk", count: 100 }] }),
  };
});

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  vi.unstubAllEnvs();
  asked.length = 0;
});

describe("an act Qloo doesn't know, with Last.fm sound-alikes", () => {
  it("asks Last.fm under the act's Spotify name, lists the sound-alikes and saves them", async () => {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
    (await import("@/server/learn/store")).resetLearnStoresForTests();
    (await import("@/server/learn/runs")).clearLearnRunsForTests();
    const research = await import("@/app/api/playlist/research/route");
    const playlist = await import("@/app/api/playlist/route");
    const res = await research.POST(req("POST", "/research", { link: SPOTIFY_ID }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    await res.text();
    // The act-name source: the Spotify profile's name (a lookup, never a model input), not empty and not Qloo's.
    expect(asked[0]).toBe("Al2 El Aldeano");
    const v = (await (await playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    const s = v.research.steps as ResearchSnapshot["steps"];
    expect(s.qloo!.output).toMatchObject({ matched: false });
    expect(s.qloo!.output!.similar!.map((a) => a.name)).toEqual(SIMILAR);
    expect(s.soundsLike!.output!.artists.map((a) => a.name)).toEqual(SIMILAR);
    expect(s.soundsLike!.output!.summary).toBe("You sound like Calle 13, Los Aldeanos, El B");
    expect(v.soundsLike.map((a: { name: string }) => a.name)).toEqual(SIMILAR);
    expect(v.soundsLike.every((a: { foundBy?: string }) => a.foundBy === "hive")).toBe(true);
  });
});
