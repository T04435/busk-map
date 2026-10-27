import "server-only";
import { neon } from "@neondatabase/serverless";
import type { ResearchTotals } from "@/lib/research-totals";
import type { WeekDayStatus, WeekRequest, WeekStepEvent, WeekUsage } from "@/lib/week-schema";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";

/**
 * The week record behind /w/<id> (migrations/007_weeks.sql): the request as sent, the run's status, the seven days (each
 * with its status and either its day plan's id, /p/<id>, or the Hive's reason) and the run's steps for the replay. The
 * pitch, hours and why of a ready day are read from its stored plan.
 */
export type WeekRecordDay = { date: string; status: WeekDayStatus; planId: string | null; reason: string | null };

export type WeekRecord = {
  id: string;
  request: WeekRequest;
  status: "running" | "done" | "failed";
  days: WeekRecordDay[];
  summary: string | null;
  notes: string[];
  events: WeekStepEvent[];
  usage: WeekUsage | null;
  totals: ResearchTotals | null;
  error: { code: string; message: string } | null;
  createdAt: number;
  finishedAt: number | null;
};

export type WeekFinish = Pick<WeekRecord, "status" | "days" | "summary" | "notes" | "events" | "usage" | "totals" | "error">;

export interface WeekStore {
  readonly kind: "postgres" | "memory";
  /** false when the id is taken (retry with another). */
  insert(row: Pick<WeekRecord, "id" | "request" | "days">): Promise<boolean>;
  get(id: string): Promise<WeekRecord | null>;
  /** Only a running week finishes: the first end (the run, or the watchdog) wins. */
  finish(id: string, result: WeekFinish): Promise<boolean>;
}

export class MemoryWeekStore implements WeekStore {
  readonly kind = "memory" as const;
  readonly rows = new Map<string, WeekRecord>();
  async insert(row: Pick<WeekRecord, "id" | "request" | "days">) {
    if (this.rows.has(row.id)) return false;
    this.rows.set(row.id, { ...structuredClone(row), status: "running", summary: null, notes: [], events: [], usage: null, totals: null, error: null, createdAt: Date.now(), finishedAt: null });
    if (this.rows.size > 500) this.rows.delete(this.rows.keys().next().value!);
    return true;
  }
  async get(id: string) {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }
  async finish(id: string, result: WeekFinish) {
    const row = this.rows.get(id);
    if (!row || row.status !== "running") return false;
    Object.assign(row, structuredClone(result), { finishedAt: Date.now() });
    return true;
  }
}

type Sql = ReturnType<typeof neon>;
type WeekRow = {
  id: string;
  request: WeekRequest;
  status: WeekRecord["status"];
  days: WeekRecordDay[];
  summary: string | null;
  notes: string[] | null;
  events: WeekStepEvent[] | null;
  usage: WeekUsage | null;
  totals: ResearchTotals | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string | Date;
  finished_at: string | Date | null;
};

/** Neon over the pooled DATABASE_URL (HTTP driver), like the plans store. */
export class PostgresWeekStore implements WeekStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async insert(row: Pick<WeekRecord, "id" | "request" | "days">) {
    const rows = (await this.sql.query("INSERT INTO weeks (id, request, status, days) VALUES ($1, $2::jsonb, 'running', $3::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id", [
      row.id,
      JSON.stringify(row.request),
      JSON.stringify(row.days),
    ])) as { id: string }[];
    return rows.length > 0;
  }

  async get(id: string) {
    const rows = (await this.sql.query("SELECT id, request, status, days, summary, notes, events, usage, totals, error_code, error_message, created_at, finished_at FROM weeks WHERE id = $1", [id])) as WeekRow[];
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      request: r.request,
      status: r.status,
      days: r.days,
      summary: r.summary,
      notes: r.notes ?? [],
      events: r.events ?? [],
      usage: r.usage,
      totals: r.totals,
      error: r.error_code ? { code: r.error_code, message: r.error_message ?? "" } : null,
      createdAt: new Date(r.created_at).getTime(),
      finishedAt: r.finished_at ? new Date(r.finished_at).getTime() : null,
    };
  }

  async finish(id: string, f: WeekFinish) {
    const rows = (await this.sql.query(
      `UPDATE weeks SET status = $2, days = $3::jsonb, summary = $4, notes = $5::jsonb, events = $6::jsonb, usage = $7::jsonb, totals = $8::jsonb, error_code = $9, error_message = $10, finished_at = now()
        WHERE id = $1 AND status = 'running' RETURNING id`,
      [
        id,
        f.status,
        JSON.stringify(f.days),
        f.summary,
        JSON.stringify(f.notes),
        JSON.stringify(f.events),
        f.usage ? JSON.stringify(f.usage) : null,
        f.totals ? JSON.stringify(f.totals) : null,
        f.error?.code ?? null,
        f.error?.message ?? null,
      ],
    )) as { id: string }[];
    return rows.length > 0;
  }
}

const stores = processMap<"db" | "memory", WeekStore>("week-stores");

/** Offline (tests): memory. With DATABASE_URL (pooled): Postgres. Without it: memory. One of each per process. */
export function weekStore(offline: boolean): WeekStore {
  const url = offline ? undefined : env().DATABASE_URL;
  const kind = url ? "db" : "memory";
  let store = stores.get(kind);
  if (!store) {
    if (!url && !offline) log.info("week records are kept in memory: DATABASE_URL is not set");
    store = url ? new PostgresWeekStore(neon(url)) : new MemoryWeekStore();
    stores.set(kind, store);
  }
  return store;
}

export function resetWeekStoresForTests() {
  stores.clear();
}
