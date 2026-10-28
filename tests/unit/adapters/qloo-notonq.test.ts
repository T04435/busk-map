import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, LIVE, mockFetch, route, timeoutError } from "../../helpers";

/**
 * Qloo through NotOnQ (lib/notonq.ts): with QLOO_PROXY_BASE_URL set, live requests go to the proxy first and to Qloo direct when
 * it fails. Synthetic payloads in Qloo's shapes plus NotOnQ's documented `notonq` block. Not Qloo or NotOnQ data.
 */
const PROXY = "https://notonq.test/q/app/busk-map";
const area = { south: -37.83, west: 144.94, north: -37.8, east: 144.98 };

const SYNTHETIC = {
  search: { results: [{ entity_id: "syn-qloo-1", name: "Synthetic Artist", popularity: 0.5, tags: [{ tag_id: "urn:tag:genre:music:folk", name: "Folk" }] }] },
  filledSearch: {
    results: [
      { entity_id: "syn-qloo-2", name: "Synthetic Namesake", popularity: 0.4 },
      { entity_id: "6f1c0d5e-0000-4000-8000-000000000001", name: "Synthetic Newcomer", types: ["urn:entity:artist"], properties: { short_description: "Not in Qloo: filled by NotOnQ from open sources. Stand-ins: Synthetic Artist." }, tags: [{ tag_id: "urn:tag:genre:music:folk", name: "Folk" }] },
      { entity_id: "6f1c0d5e-0000-4000-8000-000000000002", name: "Synthetic Tagged", properties: { short_description: "From somewhere." }, tags: [{ tag_id: "notonq:urn:tag:genre:busking", name: "Busking", type: "urn:tag:genre" }] },
    ],
    notonq: { served_by: "mixed", gap: { kind: "G1" } },
  },
  heatmap: { results: { heatmap: [{ location: { latitude: -37.81, longitude: 144.96, geohash: "r1r0fs1" }, query: { affinity: 0.9 } }] } },
  standInHeatmap: {
    results: { heatmap: [{ location: { latitude: -37.81, longitude: 144.96, geohash: "r1r0fs1" }, query: { affinity: 0.7 } }] },
    notonq: { served_by: "mixed", gap: { kind: "G2" }, proxy: { replaced: ["6f1c0d5e"], stand_ins: [{ entity_id: "syn-a", name: "Stand In A", weight: 1 }, { entity_id: "syn-b", name: "Stand In B", weight: 0.5 }] } },
  },
};

async function fresh() {
  vi.resetModules();
  return import("@/server/adapters/qloo");
}
const isProxy = (u: URL) => u.origin === "https://notonq.test";
const isDirect = (u: URL) => u.origin === "https://hackathon.api.qloo.com";
const headerOf = (init: RequestInit | undefined, name: string) => (init?.headers as Record<string, string> | undefined)?.[name];

describe("qloo through the NotOnQ proxy", () => {
  beforeEach(() => {
    vi.stubEnv("QLOO_API_KEY", "synthetic-test-key");
    vi.stubEnv("QLOO_PROXY_BASE_URL", PROXY);
  });
  afterEach(async () => (await import("@/server/adapters/qloo/budget")).resetQlooBudgetForTests());

  it("sends each request to the proxy first, with the same path, query and key plus the app label, and nothing to Qloo when it answers", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(isProxy, () => json(SYNTHETIC.search))]);
    const result = await qloo.resolveArtists(["Synthetic Artist"], LIVE);
    expect(result).toMatchObject({ mode: "live", data: [{ entity: { id: "syn-qloo-1" } }] });
    expect(result.via).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe("/q/app/busk-map/search");
    expect(calls[0].url.searchParams.get("query")).toBe("Synthetic Artist");
    expect(calls[0].url.searchParams.get("types")).toBe("urn:entity:artist");
    expect(headerOf(calls[0].init, "X-Api-Key")).toBe("synthetic-test-key");
    expect(headerOf(calls[0].init, "X-NotOnQ-App")).toBe("busk-map");
  });

  const fallbacks: [string, () => Response | Promise<Response>][] = [
    ["a timeout", () => Promise.reject(timeoutError())],
    ["a network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["502 (Qloo didn't answer the proxy)", () => json({ error: "Qloo did not answer" }, 502)],
    ["500", () => json({ error: "boom" }, 500)],
    ["429 (the proxy's daily budget or Qloo's limit)", () => json({ error: "budget" }, 429)],
    ["a body that isn't Qloo's shape", () => new Response("<html>oops</html>", { status: 200 })],
  ];
  for (const [what, proxyAnswer] of fallbacks) {
    it(`falls back to Qloo direct on ${what}, with Qloo's answer and no NotOnQ label`, async () => {
      const qloo = await fresh();
      const { calls } = mockFetch([route(isProxy, proxyAnswer), route(isDirect, () => json(SYNTHETIC.heatmap))]);
      const result = await qloo.tasteMap(["syn-qloo-1"], area, LIVE);
      expect(result.mode).toBe("live");
      expect(result.data).toHaveLength(1);
      expect(result.via).toBeUndefined();
      // A 5xx is tried once more on the proxy first (the single 5xx retry), then Qloo direct.
      const fiveXx = what.startsWith("5");
      expect(calls.map((c) => (isProxy(c.url) ? "proxy" : "direct"))).toEqual(fiveXx ? ["proxy", "proxy", "direct"] : ["proxy", "direct"]);
      // The same request: path and query unchanged, the key sent, no NotOnQ header to Qloo.
      const direct = calls.at(-1)!;
      expect(direct.url.pathname).toBe("/v2/insights");
      expect(direct.url.search).toBe(calls[0].url.search);
      expect(headerOf(direct.init, "X-Api-Key")).toBe("synthetic-test-key");
      expect(headerOf(direct.init, "X-NotOnQ-App")).toBeUndefined();
    });
  }

  it("retries a quick proxy 5xx once on the proxy, and takes its answer when the retry works", async () => {
    const qloo = await fresh();
    let n = 0;
    const { calls } = mockFetch([route(isProxy, () => (n++ === 0 ? json({}, 502) : json(SYNTHETIC.heatmap))), route(isDirect, () => json(SYNTHETIC.heatmap))]);
    expect((await qloo.tasteMap(["syn-qloo-1"], area, LIVE)).mode).toBe("live");
    expect(calls.map((c) => (isProxy(c.url) ? "proxy" : "direct"))).toEqual(["proxy", "proxy"]);
  });

  it("does not retry a slow proxy 5xx (NotOnQ's 28 s wait for Qloo): straight to Qloo direct, within the step's time", async () => {
    const { PROXY_TIMEOUT_MS, PROXY_RETRY_WITHIN_MS } = await import("@/server/adapters/qloo/client");
    const { RESEARCH_TIMEOUTS } = await import("@/server/playlist/config");
    // Worst path: a quick 5xx, its retry timing out, then Qloo direct's 15 s, inside one research step.
    expect(PROXY_RETRY_WITHIN_MS + 400 + PROXY_TIMEOUT_MS + 15_000).toBeLessThan(RESEARCH_TIMEOUTS.stepMs);
    const qloo = await fresh();
    const realNow = Date.now.bind(Date);
    let skew = 0;
    vi.spyOn(Date, "now").mockImplementation(() => realNow() + skew);
    const { calls } = mockFetch([
      route(isProxy, () => {
        skew += PROXY_RETRY_WITHIN_MS + 1_000;
        return json({}, 502);
      }),
      route(isDirect, () => json(SYNTHETIC.heatmap)),
    ]);
    expect((await qloo.tasteMap(["syn-qloo-1"], area, LIVE)).mode).toBe("live");
    expect(calls.map((c) => (isProxy(c.url) ? "proxy" : "direct"))).toEqual(["proxy", "direct"]);
  });

  it("passes Qloo's own 400 through: no direct retry, the call falls back as Qloo refused it", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(isProxy, () => json({ message: "at least one valid signal" }, 400)), route(isDirect, () => json(SYNTHETIC.heatmap))]);
    const result = await qloo.tasteMap(["syn-qloo-1"], area, LIVE);
    expect(result).toMatchObject({ mode: "fallback", reason: "http" });
    expect(calls.filter((c) => isDirect(c.url))).toHaveLength(0);
  });

  it("passes Qloo's own 404 through: /search's 'No results' is an empty answer, not a reason to ask Qloo again", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(isProxy, () => json({ message: "No results" }, 404)), route(isDirect, () => json(SYNTHETIC.search))]);
    const result = await qloo.searchArtistHits("Nobody At All", LIVE);
    expect(result).toMatchObject({ mode: "live", data: [] });
    expect(calls).toHaveLength(1);
  });

  it("does not retry a proxy 401 against Qloo", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(isProxy, () => json({ message: "No X-Api-Key" }, 401)), route(isDirect, () => json(SYNTHETIC.heatmap))]);
    expect((await qloo.tasteMap(["syn-qloo-1"], area, LIVE)).mode).toBe("fallback");
    expect(calls).toHaveLength(1);
  });

  it("charges the daily budget once per logical call, so a fallback still goes through at the last unit of budget", async () => {
    const qloo = await fresh();
    (await import("@/server/adapters/qloo/budget")).resetQlooBudgetForTests({ max: 1 });
    // The proxy's 429 (its own daily budget for this key) falls back at once; the 5xx retry is on the proxy too: neither charges twice.
    const { calls } = mockFetch([route(isProxy, () => json({}, 429)), route(isDirect, () => json(SYNTHETIC.heatmap))]);
    expect((await qloo.tasteMap(["syn-qloo-1"], area, LIVE)).mode).toBe("live");
    expect(calls).toHaveLength(2);
    // The next logical call is over the budget: refused before any request.
    expect(await qloo.tasteMap(["syn-qloo-2"], area, LIVE)).toMatchObject({ mode: "fallback", reason: "rate_limited" });
    expect(calls).toHaveLength(2);
  });

  it("carries an answer given through stand-ins as `via`, with the stand-ins' names", async () => {
    const qloo = await fresh();
    mockFetch([route(isProxy, () => json(SYNTHETIC.standInHeatmap))]);
    const result = await qloo.tasteMap(["6f1c0d5e-0000-4000-8000-000000000001"], area, LIVE);
    expect(result).toMatchObject({ mode: "live", via: { by: "notonq", standIns: ["Stand In A", "Stand In B"] } });
    expect(result.data[0]).toMatchObject({ affinity: 0.7 });
  });

  it("labels artists NotOnQ filled in (a 'Not in Qloo' description or NotOnQ's own tags) and leaves Qloo's own unlabelled", async () => {
    const qloo = await fresh();
    mockFetch([route(isProxy, () => json(SYNTHETIC.filledSearch))]);
    const result = await qloo.searchArtistHits("Synthetic Newcomer", LIVE);
    expect(result.data.map((e) => [e.name, e.filledBy ?? null])).toEqual([
      ["Synthetic Namesake", null],
      ["Synthetic Newcomer", "notonq"],
      ["Synthetic Tagged", "notonq"],
    ]);
    // A /search answer is not a stand-in answer.
    expect(result.via).toBeUndefined();
  });
});

describe("the heatmap boundary", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "synthetic-test-key"));

  it("sends only Qloo's valid output.heatmap.boundary values, never 'city' or 'neighborhood'", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(isDirect, () => json(SYNTHETIC.heatmap))]);
    await qloo.tasteMap(["syn-qloo-1"], area, LIVE, "urn:entity:locality");
    await qloo.tasteMap(["syn-qloo-2"], area, LIVE, "urn:geohash");
    for (const bad of ["city", "neighborhood"]) await qloo.tasteMap(["syn-qloo-3"], area, LIVE, bad as never);
    expect(calls.map((c) => c.url.searchParams.get("output.heatmap.boundary"))).toEqual(["urn:entity:locality", "urn:geohash", null, null]);
  });
});

describe("qloo without the proxy", () => {
  beforeEach(() => vi.stubEnv("QLOO_API_KEY", "synthetic-test-key"));

  it("talks to Qloo direct only, with no NotOnQ header", async () => {
    const qloo = await fresh();
    const { calls } = mockFetch([route(isDirect, () => json(SYNTHETIC.search))]);
    await qloo.resolveArtists(["Synthetic Artist"], LIVE);
    expect(calls).toHaveLength(1);
    expect(headerOf(calls[0].init, "X-NotOnQ-App")).toBeUndefined();
  });
});

describe("the RAW call log", () => {
  it("records a request sent through the proxy as the Qloo endpoint it stands for", async () => {
    const { noteFetch, recordCalls } = await import("@/server/adapters/call-log");
    const list: import("@/lib/call-record").CallRecord[] = [];
    await recordCalls(list, async () => {
      noteFetch("qloo", `${PROXY}/v2/insights?filter.type=urn%3Aheatmap`, 200, { results: [] }, 5);
      noteFetch("qloo", "https://notonq.test/q/search?query=x", 200, { results: [] }, 5);
      noteFetch("songs", "https://example.test/q/app/x/y", 200, {}, 5);
    });
    expect(list.map((c) => c.endpoint)).toEqual(["/v2/insights", "/search", "/q/app/x/y"]);
  });
});

describe("NotOnQ provenance helpers", () => {
  it("reads the notonq block leniently: stand-in names once each, an odd block dropped without losing Qloo's answer", async () => {
    const { heatmapResponseSchema } = await import("@/server/adapters/qloo/schema");
    const parsed = heatmapResponseSchema.parse({ ...SYNTHETIC.standInHeatmap, notonq: { ...SYNTHETIC.standInHeatmap.notonq, proxy: { stand_ins: [{ name: " Stand In A " }, { name: "Stand In A" }, {}] } } });
    expect(parsed.notonq).toEqual({ servedBy: "mixed", gapKind: "G2", standIns: ["Stand In A"] });
    const odd = heatmapResponseSchema.parse({ ...SYNTHETIC.heatmap, notonq: "not an object" });
    expect(odd.notonq).toBeUndefined();
    expect(odd.results.heatmap).toHaveLength(1);
  });

  it("only an answer served for stand-ins (mixed or fallback, with stand-ins or a G2 gap) is `via` NotOnQ", async () => {
    const { viaOf, tagVia, untagVia, collectVia } = await import("@/server/adapters/qloo/via");
    expect(viaOf(undefined)).toBeNull();
    expect(viaOf({ servedBy: "qloo", gapKind: null, standIns: ["A"] })).toBeNull();
    expect(viaOf({ servedBy: "needs_choice", gapKind: "G1", standIns: [] })).toBeNull();
    expect(viaOf({ servedBy: "fallback", gapKind: "G1", standIns: [] })).toBeNull();
    expect(viaOf({ servedBy: "fallback", gapKind: "G2", standIns: [] })).toEqual({ by: "notonq", standIns: [] });
    expect(viaOf({ servedBy: "mixed", gapKind: null, standIns: ["A"] })).toEqual({ by: "notonq", standIns: ["A"] });
    // A value cached before tagging existed, and any untagged value, passes through.
    expect(untagVia([1, 2])).toEqual([1, 2]);
    expect(untagVia(null)).toBeNull();
    const { value, via } = await collectVia(async () => [untagVia(tagVia([1], { servedBy: "mixed", gapKind: "G2", standIns: ["A"] })), untagVia(tagVia([2], { servedBy: "mixed", gapKind: "G2", standIns: ["B", "A"] }))]);
    expect(value).toEqual([[1], [2]]);
    expect(via).toEqual({ by: "notonq", standIns: ["A", "B"] });
    expect((await collectVia(async () => untagVia({ a: 1 }))).via).toBeNull();
  });

  it("labels and merges in plain words", async () => {
    const { FILLED_BY_NOTONQ, viaStandInsLabel, isNotOnQFilled, mergeVia, filledMark, viaMark } = await import("@/lib/notonq");
    expect(FILLED_BY_NOTONQ).toBe("Filled by NotOnQ");
    expect(viaStandInsLabel(["A", "B"])).toBe("Via NotOnQ stand-ins: A, B");
    expect(viaStandInsLabel([])).toBe("Via NotOnQ stand-ins");
    expect(isNotOnQFilled({ shortDescription: "Not in Qloo: a possible match (AU, 10 listeners)" })).toBe(true);
    expect(isNotOnQFilled({ shortDescription: "An Australian band. Not in Qloo terms." })).toBe(false);
    expect(isNotOnQFilled({ tagIds: ["urn:tag:genre:music:folk", "notonq:urn:tag:genre:x"] })).toBe(true);
    expect(isNotOnQFilled({})).toBe(false);
    expect(mergeVia([null, undefined])).toBeNull();
    expect(filledMark("notonq")).toEqual({ filledBy: "notonq" });
    expect(filledMark(null)).toEqual({});
    expect(filledMark(undefined)).toEqual({});
    expect(viaMark(null)).toEqual({});
    expect(viaMark({ by: "notonq", standIns: ["A"] })).toEqual({ via: { by: "notonq", standIns: ["A"] } });
  });
});
