import "server-only";
import { neon } from "@neondatabase/serverless";
import type { City } from "@/lib/city";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";

/**
 * The cities busks are planned in, table `cities` from migrations/013_cities.sql: one row per slug, upserted each time a
 * plan runs there (a fresh agent run, not a replay). Offline mode and a server without DATABASE_URL keep them in memory.
 */
export type CityRecord = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timeZone: string;
  firstUsedAt: number;
  lastUsedAt: number;
  plansCount: number;
};

export interface CityStore {
  readonly kind: "postgres" | "memory";
  /** Record one plan in this city: insert it, or bump its count and last use. */
  recordUse(city: City, at?: number): Promise<void>;
  /** Most recently used first. */
  list(limit?: number): Promise<CityRecord[]>;
}

export class MemoryCityStore implements CityStore {
  readonly kind = "memory" as const;
  readonly rows = new Map<string, CityRecord>();

  async recordUse(city: City, at = Date.now()) {
    const row = this.rows.get(city.id);
    const fields = { slug: city.id, name: city.name, country: city.country, countryCode: city.countryCode, lat: city.center.lat, lon: city.center.lon, timeZone: city.timeZone };
    this.rows.set(city.id, row ? { ...row, ...fields, lastUsedAt: at, plansCount: row.plansCount + 1 } : { ...fields, firstUsedAt: at, lastUsedAt: at, plansCount: 1 });
  }

  async list(limit = 50) {
    return [...this.rows.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, limit);
  }
}

type Sql = ReturnType<typeof neon>;

type CityRow = {
  slug: string;
  name: string;
  country: string;
  country_code: string;
  lat: number;
  lon: number;
  timezone: string;
  first_used_at: string | Date;
  last_used_at: string | Date;
  plans_count: number;
};

const ms = (v: string | Date) => new Date(v).getTime();

/** Neon over the pooled DATABASE_URL (HTTP driver). */
export class PostgresCityStore implements CityStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async recordUse(city: City, at = Date.now()) {
    await this.sql.query(
      `INSERT INTO cities (slug, name, country, country_code, lat, lon, timezone, first_used_at, last_used_at, plans_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8::double precision / 1000), to_timestamp($8::double precision / 1000), 1)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country, country_code = EXCLUDED.country_code,
         lat = EXCLUDED.lat, lon = EXCLUDED.lon, timezone = EXCLUDED.timezone, last_used_at = EXCLUDED.last_used_at,
         plans_count = cities.plans_count + 1`,
      [city.id, city.name, city.country, city.countryCode, city.center.lat, city.center.lon, city.timeZone, at],
    );
  }

  async list(limit = 50) {
    const rows = (await this.sql.query(
      "SELECT slug, name, country, country_code, lat, lon, timezone, first_used_at, last_used_at, plans_count FROM cities ORDER BY last_used_at DESC LIMIT $1",
      [limit],
    )) as CityRow[];
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      country: r.country,
      countryCode: r.country_code,
      lat: Number(r.lat),
      lon: Number(r.lon),
      timeZone: r.timezone,
      firstUsedAt: ms(r.first_used_at),
      lastUsedAt: ms(r.last_used_at),
      plansCount: Number(r.plans_count),
    }));
  }
}

const stores = processMap<"db" | "memory", CityStore>("city-stores");

/** Offline (tests): memory. With DATABASE_URL (pooled): Postgres. Without it: memory. One of each per process. */
export function cityStore(offline: boolean): CityStore {
  const url = offline ? undefined : env().DATABASE_URL;
  const kind = url ? "db" : "memory";
  let store = stores.get(kind);
  if (!store) {
    store = url ? new PostgresCityStore(neon(url)) : new MemoryCityStore();
    stores.set(kind, store);
  }
  return store;
}

/** Record a plan in this city. Never throws: the city log is bookkeeping and must not fail a plan. */
export async function recordCityUse(store: CityStore, city: City, at = Date.now()): Promise<void> {
  try {
    await store.recordUse(city, at);
  } catch (error) {
    log.warn("city use not recorded", { store: store.kind, city: city.id, error: error instanceof Error ? error.message : "unknown" });
  }
}

export function resetCityStoresForTests() {
  stores.clear();
}
