import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cityFromPlace, MELBOURNE } from "@/lib/city";
import { cityStore, MemoryCityStore, PostgresCityStore, recordCityUse, resetCityStoresForTests } from "@/server/cities-store";
import { statements } from "../../../scripts/migrate-lib.mjs";

const tokyo = cityFromPlace("tokyo-jp", { name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo" });

afterEach(() => {
  vi.unstubAllEnvs();
  resetCityStoresForTests();
});

describe("cities store", () => {
  it("memory: inserts a city on its first plan, then counts plans and moves its last use", async () => {
    const store = new MemoryCityStore();
    await store.recordUse(MELBOURNE, 1000);
    await store.recordUse(tokyo, 2000);
    await store.recordUse(MELBOURNE, 3000);
    const [first, second] = await store.list();
    expect(first).toEqual({ slug: "melbourne", name: "Melbourne", country: "Australia", countryCode: "AU", lat: -37.8136, lon: 144.9631, timeZone: "Australia/Melbourne", firstUsedAt: 1000, lastUsedAt: 3000, plansCount: 2 });
    expect(second).toMatchObject({ slug: "tokyo-jp", plansCount: 1, firstUsedAt: 2000, lastUsedAt: 2000 });
  });

  it("postgres: one idempotent upsert per plan, keyed by slug", async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const sql = { query: async (text: string, params: unknown[]) => (calls.push({ text, params }), []) };
    await new PostgresCityStore(sql as never).recordUse(tokyo, 5000);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toMatch(/INSERT INTO cities [\s\S]* ON CONFLICT \(slug\) DO UPDATE SET [\s\S]*plans_count = cities\.plans_count \+ 1/);
    expect(calls[0].params).toEqual(["tokyo-jp", "Tokyo", "Japan", "JP", 35.6895, 139.6917, "Asia/Tokyo", 5000]);
  });

  it("offline mode keeps cities in memory, and a failing store never throws", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pw@example.invalid/db");
    expect(cityStore(true).kind).toBe("memory");
    const broken = { kind: "postgres" as const, recordUse: async () => Promise.reject(new Error("down")), list: async () => [] };
    await expect(recordCityUse(broken, tokyo)).resolves.toBeUndefined();
  });

  it("the migration is idempotent and matches the store's columns", () => {
    const sql = readFileSync("migrations/013_cities.sql", "utf8");
    const parts = statements(sql);
    expect(parts.every((s: string) => /IF NOT EXISTS/.test(s))).toBe(true);
    for (const column of ["slug", "name", "country", "country_code", "lat", "lon", "timezone", "first_used_at", "last_used_at", "plans_count"]) expect(sql).toContain(column);
  });
});
