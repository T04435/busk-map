import { describe, expect, it } from "vitest";
import type { CallRecord } from "@/lib/call-record";
import { cacheBody, cachedCall, noteFetch, recordCalls, resultCount, safeParams } from "@/server/adapters/call-log";

/** The per-step call records (adapters/call-log.ts): what a request, a miss and a cache hit each leave behind. */
describe("call records", () => {
  it("a request: endpoint from the path (Last.fm: the method), keys and tokens stripped, status and result count", async () => {
    const list: CallRecord[] = [];
    await recordCalls(list, async () => {
      noteFetch("songs", "https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=Yomil&limit=10&api_key=SECRET&format=json", 200, { similarartists: { artist: [{ name: "A" }, { name: "B" }] } }, 12.4);
      noteFetch("qloo", "https://qloo-mock.invalid/v2/insights?filter.type=urn:entity:artist&signal.interests.entities=x", 429, null, 3);
      noteFetch("repertoire", "https://api.spotify.com/v1/artists/abc?access_token=t", 200, { name: "X", genres: [] }, 5);
    });
    expect(list).toEqual([
      { provider: "lastfm", endpoint: "artist.getsimilar", params: { artist: "Yomil", limit: "10" }, status: 200, count: 2, ms: 12, cached: false },
      { provider: "qloo", endpoint: "/v2/insights", params: { "filter.type": "urn:entity:artist", "signal.interests.entities": "x" }, status: 429, count: 0, ms: 3, cached: false },
      { provider: "spotify", endpoint: "/artists/abc", params: {}, status: 200, count: 1, ms: 5, cached: false },
    ]);
  });

  it("a miss publishes the body's calls to the caller; a later hit is recorded as cached, with the same endpoint", async () => {
    const list: CallRecord[] = [];
    const load = () => cacheBody("t.lookup", ["a"], async () => (noteFetch("qloo", "https://q.invalid/search?query=a", 200, { results: [1, 2, 3] }, 4), [1, 2, 3]));
    await recordCalls(list, () => cachedCall("qloo", "t.lookup", ["a"], load, { endpoint: "/search", params: { query: "a" } }));
    // A hit: the cache answered, so the body never ran.
    await recordCalls(list, () => cachedCall("qloo", "t.lookup", ["a"], async () => [1, 2, 3], { endpoint: "/search", params: { query: "a" } }));
    await recordCalls(list, () => cachedCall("qloo", "t.never", ["b"], async () => ({ results: { entities: [1] } }), { endpoint: "/v2/insights", params: { b: "b" } }));
    expect(list.map((c) => [c.endpoint, c.status, c.count, c.cached])).toEqual([
      ["/search", 200, 3, false],
      ["/search", 200, 3, true],
      ["/v2/insights", null, 1, true],
    ]);
  });

  it("params and counts", () => {
    expect(safeParams([["api_key", "x"], ["X-Api-Key", "y"], ["client_secret", "z"], ["q", "a"], ["n", 3], ["e", undefined], ["long", "x".repeat(300)]])).toEqual({ q: "a", n: "3", long: `${"x".repeat(157)}...` });
    expect(resultCount(null)).toBe(0);
    expect(resultCount({ toptags: { tag: [{}, {}] } })).toBe(2);
    expect(resultCount({ id: "x" })).toBe(1);
  });
});
