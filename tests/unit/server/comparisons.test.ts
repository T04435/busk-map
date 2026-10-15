import { describe, expect, it, vi } from "vitest";
import type { ComparisonRecord } from "@/server/scoring";

async function load() {
  vi.resetModules();
  const store = await import("@/server/comparisons/store");
  // Stores live on globalThis (one per process): start each test clean.
  store.resetComparisonStoresForTests();
  return store;
}

const record = (overlap: number, ours: number[], plain: (number | null)[], performerKey = "acoustic"): ComparisonRecord => ({
  performerKey,
  city: "melbourne",
  slot: "2026-10-17 18-21",
  overlap,
  ours: ours.map((score, i) => ({ pitchId: `p${i}`, score, agreed: i < overlap })),
  plain: plain.map((score) => ({ status: score === null ? "no-data" : "scored", score, pitchId: null })),
});

describe("comparison store", () => {
  it("aggregates the uniqueness rate and score delta (memory store)", async () => {
    const { MemoryComparisonStore } = await load();
    const store = new MemoryComparisonStore();
    expect(await store.stats()).toEqual({ runs: 0, picks: 0, uniquePicks: 0, uniqueRate: null, averageOverlap: null, averageScoreDelta: null, runsWithScoredPlainSpots: 0 });
    await store.record(record(1, [80, 70, 60], [50, null, 40]));
    await store.record(record(0, [60, 60, 60], [null, null, null]));
    expect(await store.stats()).toEqual({
      runs: 2,
      picks: 6,
      uniquePicks: 5,
      uniqueRate: 5 / 6,
      averageOverlap: 0.5,
      averageScoreDelta: 70 - 45,
      runsWithScoredPlainSpots: 1,
    });
  });

  it("without DATABASE_URL, recording is a no-op with a single log line and there are no stats", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { comparisonStore, recordComparison } = await load();
    const { log } = await import("@/server/log");
    const info = vi.spyOn(log, "info").mockImplementation(() => {});
    const store = comparisonStore(false);
    expect(store.kind).toBe("none");
    await recordComparison(store, record(0, [1], []));
    await recordComparison(store, record(0, [1], []));
    expect(info).toHaveBeenCalledTimes(1);
    expect(await store.stats()).toBeNull();
    expect(comparisonStore(false)).toBe(store);
    expect(comparisonStore(true).kind).toBe("memory");
  });

  it("with DATABASE_URL, uses Postgres", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@example.invalid/db");
    const { comparisonStore } = await load();
    expect(comparisonStore(false).kind).toBe("postgres");
  });

  it("Postgres: no DDL at runtime, inserts ids and scores only, and reads the aggregate", async () => {
    const { PostgresComparisonStore } = await load();
    const queries: { text: string; params?: unknown[] }[] = [];
    const sql = {
      query: vi.fn(async (text: string, params?: unknown[]): Promise<unknown[]> => {
        queries.push({ text, params });
        if (text.startsWith("SELECT")) return [{ runs: 2, picks: 6, unique_picks: 5, average_overlap: 0.5, average_score_delta: 25, runs_with_scored: 1 }];
        return [];
      }),
    };
    const store = new PostgresComparisonStore(sql as never);
    await store.record(record(1, [80, 70, 60], [50, null, 40]));
    await store.record(record(0, [60], []));
    // Migrations run ahead of time over the direct connection (scripts/migrate.mjs), never from the app.
    expect(queries.filter((q) => /CREATE|ALTER|DROP/.test(q.text))).toHaveLength(0);
    const insert = queries.find((q) => q.text.startsWith("INSERT"))!;
    expect(insert.params).toEqual(["acoustic", "melbourne", "2026-10-17 18-21", 1, expect.any(String), expect.any(String), 70, 45]);
    expect(queries.filter((q) => q.text.startsWith("INSERT")).at(-1)!.params!.at(-1)).toBeNull();
    expect(await store.stats()).toEqual({ runs: 2, picks: 6, uniquePicks: 5, uniqueRate: 5 / 6, averageOverlap: 0.5, averageScoreDelta: 25, runsWithScoredPlainSpots: 1 });
    sql.query.mockImplementationOnce(async () => [{ runs: 0, picks: 0, unique_picks: 0, average_overlap: null, average_score_delta: null, runs_with_scored: 0 }]);
    expect((await store.stats()).uniqueRate).toBeNull();
  });

  it("a failing database (or a missing table) never fails the caller", async () => {
    const { PostgresComparisonStore, recordComparison } = await load();
    const { log } = await import("@/server/log");
    const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
    let fail = true;
    const sql = { query: vi.fn(async (text: string): Promise<unknown[]> => (fail ? Promise.reject(new Error(`down: ${text.length}`)) : [])) };
    const store = new PostgresComparisonStore(sql as never);
    await expect(recordComparison(store, record(0, [1], []))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("baseline comparison not recorded", { store: "postgres", error: expect.stringMatching(/^down/) });
    fail = false;
    await recordComparison(store, record(0, [1], []));
    expect(sql.query.mock.calls.some((c) => String(c[0]).startsWith("INSERT"))).toBe(true);
  });
});
