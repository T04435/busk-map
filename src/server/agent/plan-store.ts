import "server-only";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { PlanRequest } from "@/lib/plan-schema";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";

/**
 * Finished agent runs and plain-AI baselines, keyed by the plan, shared by
 * every server instance (Neon, table plan_store from
 * migrations/002_agent_v2.sql). Offline and in tests: this process's memory.
 * Without DATABASE_URL: memory too (one instance, as before). Reads and
 * writes never fail the caller: a store error is a miss.
 */
export type StoreKind = "run" | "baseline";

export interface PlanStore {
  readonly kind: "postgres" | "memory";
  get<T>(kind: StoreKind, key: string): Promise<{ value: T; createdAt: number } | null>;
  put(kind: StoreKind, key: string, value: unknown, ttlMs: number): Promise<void>;
}

/** The plan's key: the request, test mode and day, hashed (the request holds the act's details). */
export function planKey(request: PlanRequest, offline: boolean, day: string): string {
  return createHash("sha256").update(JSON.stringify([request, offline, day])).digest("hex").slice(0, 40);
}

export class MemoryPlanStore implements PlanStore {
  readonly kind = "memory" as const;
  private readonly rows = new Map<string, { value: unknown; createdAt: number; expiresAt: number }>();
  async get<T>(kind: StoreKind, key: string, now = Date.now()) {
    const row = this.rows.get(`${kind}:${key}`);
    if (!row) return null;
    if (row.expiresAt <= now) {
      this.rows.delete(`${kind}:${key}`);
      return null;
    }
    return { value: row.value as T, createdAt: row.createdAt };
  }
  async put(kind: StoreKind, key: string, value: unknown, ttlMs: number, now = Date.now()) {
    this.rows.set(`${kind}:${key}`, { value: structuredClone(value), createdAt: now, expiresAt: now + ttlMs });
    if (this.rows.size > 200) this.rows.delete(this.rows.keys().next().value!);
  }
}

type Sql = ReturnType<typeof neon>;

export class PostgresPlanStore implements PlanStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async get<T>(kind: StoreKind, key: string) {
    const rows = (await this.sql.query("SELECT value, created_at, expires_at > now() AS fresh FROM plan_store WHERE kind = $1 AND plan_key = $2", [kind, key])) as {
      value: T;
      created_at: string | Date;
      fresh: boolean;
    }[];
    const row = rows[0];
    if (!row) return null;
    if (!row.fresh) {
      await this.sql.query("DELETE FROM plan_store WHERE kind = $1 AND plan_key = $2", [kind, key]);
      return null;
    }
    return { value: row.value, createdAt: new Date(row.created_at).getTime() };
  }

  async put(kind: StoreKind, key: string, value: unknown, ttlMs: number) {
    await this.sql.query(
      `INSERT INTO plan_store (kind, plan_key, value, expires_at) VALUES ($1, $2, $3::jsonb, now() + ($4 || ' milliseconds')::interval)
       ON CONFLICT (kind, plan_key) DO UPDATE SET value = EXCLUDED.value, created_at = now(), expires_at = EXCLUDED.expires_at`,
      [kind, key, JSON.stringify(value), String(ttlMs)],
    );
  }
}

const stores = processMap<"db" | "memory", PlanStore>("plan-stores");

/** Offline (tests) or no DATABASE_URL: memory. Otherwise Postgres. One of each per process. */
export function planStore(offline: boolean): PlanStore {
  const url = offline ? undefined : env().DATABASE_URL;
  const kind = url ? "db" : "memory";
  let store = stores.get(kind);
  if (!store) {
    store = url ? new PostgresPlanStore(neon(url)) : new MemoryPlanStore();
    stores.set(kind, store);
  }
  return store;
}

/** A store read that never throws (an error is a miss). */
export async function storeGet<T>(store: PlanStore, kind: StoreKind, key: string): Promise<{ value: T; createdAt: number } | null> {
  try {
    return await store.get<T>(kind, key);
  } catch (error) {
    log.warn("plan store read failed", { store: store.kind, kind, error: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

/** A store write that never throws. */
export async function storePut(store: PlanStore, kind: StoreKind, key: string, value: unknown, ttlMs: number): Promise<void> {
  try {
    await store.put(kind, key, value, ttlMs);
  } catch (error) {
    log.warn("plan store write failed", { store: store.kind, kind, error: error instanceof Error ? error.message : "unknown" });
  }
}

export function resetPlanStoresForTests() {
  stores.clear();
}
