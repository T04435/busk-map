import { describe, expect, it, vi } from "vitest";

// Route handlers call next/server's connection() (request scope only): a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }));

async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  const store = await import("@/server/comparisons/store");
  store.resetComparisonStoresForTests();
  const { GET } = await import("@/app/api/baseline-stats/route");
  return { GET, store };
}

describe("GET /api/baseline-stats: agent divergence (in-memory store, offline)", () => {
  it("n = 0: the rate is null and there is no date range", async () => {
    const { GET } = await load();
    const body = await (await GET()).json();
    expect(body).toMatchObject({ store: "memory", agentDiffersRate: null, n: 0, dateRange: null });
  });

  it("reports the rate, its sample size and the runs' date range beside the unique-picks figures", async () => {
    const { GET, store } = await load();
    const memory = store.comparisonStore(true);
    const engine = [{ id: "a", score: 80 }, { id: "b", score: 70 }, { id: "c", score: 60 }];
    await memory.recordAgent({ ...store.agentRecord("k1", "acoustic", "melbourne", "s", engine, engine), at: Date.parse("2026-10-14T08:00:00Z") });
    await memory.recordAgent({ ...store.agentRecord("k2", "sax", "melbourne", "s", engine, [engine[1], engine[0], engine[2]]), at: Date.parse("2026-10-16T08:00:00Z") });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ agentDiffersRate: 0.5, n: 2, dateRange: { from: "2026-10-14", to: "2026-10-16" } });
    expect(body.stats).toMatchObject({ uniqueRate: null, averageScoreDelta: null, agentSampleSize: 2 });
    expect(body.summary).toContain("divergence 50%");
  });
});
