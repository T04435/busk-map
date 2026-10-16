import "server-only";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { Plan, PlanRequest, PlanStreamEvent } from "@/lib/plan-schema";
import { newPlanId } from "@/lib/plan-id";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";

/**
 * Plans behind short ids (/p/<id>), table `plans` from migrations/003_plans.sql.
 *
 * A row holds the validated plan request as the act typed it (name, artists,
 * songs, slot, permit, weights) and, once the agent finishes, the plan and the
 * agent's steps, so the link shows at once. The tip-log history is never
 * stored: it comes from the viewer's own cookie when the plan is opened.
 *
 * The same canonical request on the same Melbourne day maps to the same id,
 * so reloads and the examples don't create rows.
 */
export type StoredPlanRequest = Omit<PlanRequest, "history">;

export type PlanSnapshot = {
  plan: Plan;
  /** The run's stream events, the plan event left out (it is `plan`). */
  events: PlanStreamEvent[];
  explanations: Plan["explanations"];
  /** The plan-store key of the run (request, test mode and day). */
  runKey: string;
  /** The Melbourne day the run's key was made for. */
  runDay: string;
  startedAt: number;
  finishedAt: number;
};

export type StoredPlan = {
  id: string;
  request: StoredPlanRequest;
  exampleId: string | null;
  /** Melbourne day the id was made (dedupe). */
  day: string;
  createdAt: number;
  snapshot: PlanSnapshot | null;
};

export type NewPlanRow = { id: string; request: StoredPlanRequest; requestHash: string; exampleId: string | null; day: string };

export interface ShortPlanStore {
  readonly kind: "postgres" | "memory";
  findByRequest(requestHash: string, day: string): Promise<string | null>;
  /** "duplicate-request": another row has this request and day (a race); "id-taken": the id collided. */
  insert(row: NewPlanRow): Promise<"ok" | "duplicate-request" | "id-taken">;
  get(id: string): Promise<StoredPlan | null>;
  /** Store the finished run. Without `overwrite`, only when the plan has none yet. */
  saveSnapshot(id: string, snapshot: PlanSnapshot, overwrite: boolean): Promise<boolean>;
}

/** JSON with object keys sorted at every level (arrays keep their order). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]])) : v,
  );
}

/** The request as stored. The schema has no tip history any more (an old stored one is dropped on parse), so hashes of existing links are unchanged. */
export function storedRequestOf(request: PlanRequest): StoredPlanRequest {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { history, ...rest } = request;
  return rest;
}

export function requestHash(request: StoredPlanRequest, exampleId: string | null): string {
  return createHash("sha256").update(canonicalJson([request, exampleId])).digest("hex");
}

export class MemoryShortPlanStore implements ShortPlanStore {
  readonly kind = "memory" as const;
  readonly rows = new Map<string, StoredPlan & { requestHash: string }>();

  async findByRequest(hash: string, day: string) {
    for (const row of this.rows.values()) if (row.requestHash === hash && row.day === day) return row.id;
    return null;
  }
  async insert(row: NewPlanRow) {
    if (this.rows.has(row.id)) return "id-taken" as const;
    if (await this.findByRequest(row.requestHash, row.day)) return "duplicate-request" as const;
    this.rows.set(row.id, { ...structuredClone(row), createdAt: Date.now(), snapshot: null });
    if (this.rows.size > 1000) this.rows.delete(this.rows.keys().next().value!);
    return "ok" as const;
  }
  async get(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { requestHash: _hash, ...plan } = structuredClone(row);
    return plan;
  }
  async saveSnapshot(id: string, snapshot: PlanSnapshot, overwrite: boolean) {
    const row = this.rows.get(id);
    if (!row || (row.snapshot && !overwrite)) return false;
    row.snapshot = structuredClone(snapshot);
    return true;
  }
}

type Sql = ReturnType<typeof neon>;

type PlanRow = {
  id: string;
  request: StoredPlanRequest;
  example_id: string | null;
  day: string;
  created_at: string | Date;
  plan: Plan | null;
  steps: PlanStreamEvent[] | null;
  explanations: Plan["explanations"] | null;
  run_key: string | null;
  run_day: string | null;
  run_started_at: string | Date | null;
  finished_at: string | Date | null;
};

const ms = (v: string | Date) => new Date(v).getTime();

/** Neon over the pooled DATABASE_URL (HTTP driver). */
export class PostgresShortPlanStore implements ShortPlanStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async findByRequest(hash: string, day: string) {
    const rows = (await this.sql.query("SELECT id FROM plans WHERE request_hash = $1 AND day = $2::date", [hash, day])) as { id: string }[];
    return rows[0]?.id ?? null;
  }

  async insert(row: NewPlanRow) {
    try {
      const rows = (await this.sql.query(
        `INSERT INTO plans (id, request, request_hash, example_id, day) VALUES ($1, $2::jsonb, $3, $4, $5::date)
         ON CONFLICT (request_hash, day) DO NOTHING RETURNING id`,
        [row.id, JSON.stringify(row.request), row.requestHash, row.exampleId, row.day],
      )) as { id: string }[];
      return rows.length ? ("ok" as const) : ("duplicate-request" as const);
    } catch (error) {
      // The ON CONFLICT covers the request; a unique violation left is the primary key: the id collided.
      if ((error as { code?: string }).code === "23505") return "id-taken" as const;
      throw error;
    }
  }

  async get(id: string) {
    const rows = (await this.sql.query(
      `SELECT id, request, example_id, day::text AS day, created_at, plan, steps, explanations, run_key, run_day::text AS run_day, run_started_at, finished_at
         FROM plans WHERE id = $1`,
      [id],
    )) as PlanRow[];
    const r = rows[0];
    if (!r) return null;
    const snapshot: PlanSnapshot | null =
      r.plan && r.steps && r.explanations && r.run_key && r.run_day && r.run_started_at && r.finished_at
        ? { plan: r.plan, events: r.steps, explanations: r.explanations, runKey: r.run_key, runDay: r.run_day, startedAt: ms(r.run_started_at), finishedAt: ms(r.finished_at) }
        : null;
    return { id: r.id, request: r.request, exampleId: r.example_id, day: r.day, createdAt: ms(r.created_at), snapshot };
  }

  async saveSnapshot(id: string, s: PlanSnapshot, overwrite: boolean) {
    const rows = (await this.sql.query(
      `UPDATE plans SET plan = $2::jsonb, steps = $3::jsonb, explanations = $4, run_key = $5, run_day = $6::date,
              run_started_at = to_timestamp($7::double precision / 1000), finished_at = to_timestamp($8::double precision / 1000)
        WHERE id = $1 AND ($9::boolean OR plan IS NULL) RETURNING id`,
      [id, JSON.stringify(s.plan), JSON.stringify(s.events), s.explanations, s.runKey, s.runDay, s.startedAt, s.finishedAt, overwrite],
    )) as { id: string }[];
    return rows.length > 0;
  }
}

const stores = processMap<"db" | "memory", ShortPlanStore>("short-plan-stores");

/** Offline (tests): memory. With DATABASE_URL (pooled): Postgres. Without it: memory, said once in the log. One of each per process. */
export function shortPlanStore(offline: boolean): ShortPlanStore {
  const url = offline ? undefined : env().DATABASE_URL;
  const kind = url ? "db" : "memory";
  let store = stores.get(kind);
  if (!store) {
    if (!url && !offline) log.info("short plan links are kept in memory: DATABASE_URL is not set");
    store = url ? new PostgresShortPlanStore(neon(url)) : new MemoryShortPlanStore();
    stores.set(kind, store);
  }
  return store;
}

/**
 * Whether a short link made now will still open later. Memory only lasts on a
 * single long-lived server (local dev, `next start`); on Vercel without a
 * database the long /plan?… URL is kept instead.
 */
export function linksDurable(store: ShortPlanStore): boolean {
  return store.kind === "postgres" || !process.env.VERCEL;
}

/** The plan's id for this request today, or null. */
export async function findPlanId(store: ShortPlanStore, request: PlanRequest, exampleId: string | null, day: string): Promise<string | null> {
  return store.findByRequest(requestHash(storedRequestOf(request), exampleId), day);
}

/**
 * A new id for this request (or the one a concurrent request just made).
 * Collisions are retried with a new id. An example preset gets a new id every
 * time: its hash carries the id, so (request_hash, day) never dedupes it.
 */
export async function createPlanId(
  store: ShortPlanStore,
  request: PlanRequest,
  exampleId: string | null,
  day: string,
  makeId: () => string = newPlanId,
): Promise<string> {
  const stored = storedRequestOf(request);
  const hash = requestHash(stored, exampleId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = makeId();
    const rowHash = exampleId ? `${hash}:${id}` : hash;
    const result = await store.insert({ id, request: stored, requestHash: rowHash, exampleId, day });
    if (result === "ok") return id;
    if (result === "duplicate-request") {
      const existing = await store.findByRequest(hash, day);
      if (existing) return existing;
    }
  }
  throw new Error("could not allocate a plan id");
}

export function resetShortPlanStoresForTests() {
  stores.clear();
}
