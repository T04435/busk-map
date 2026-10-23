import "server-only";
import { neon } from "@neondatabase/serverless";
import { storeDatabaseUrl } from "@/server/env";
import { log } from "@/server/log";
import { AdapterError } from "../core";

/**
 * Spotify politeness (U34, 19 Oct 2026: the app was limited for about 20 h after a 256-release catalogue run).
 * - Pacer: every Spotify call in this process starts at least PACE_MS after the previous one (2 a second), and no more
 *   than WINDOW_MAX_CALLS start in any rolling WINDOW_MS (Spotify limits on a rolling 30 s window). A call that would
 *   wait longer than its allowance for a slot (MAX_QUEUE_WAIT_MS; a catalogue fetch allows more) fails fast with
 *   `rate_limited`, so typeahead and secondary lookups fall back instead of queueing.
 * - Circuit breaker: a 429 with a long Retry-After records "limited until T"; every later call fails fast (no network)
 *   until T. T is kept in memory and in the `adapter_backoff` row (migrations/011), so a restart or another instance
 *   respects it. Without a database (offline, tests) it stays in memory.
 * - Daily cap: every call is counted per UTC day, app-wide, in `adapter_usage` (migrations/012). At DAILY_MAX_CALLS the
 *   breaker opens until the next UTC midnight. Instances also count in memory, so a database error never stops the count.
 */
export const PACE_MS = 500;
/** Spotify's limit is a rolling 30 s window; this process starts at most WINDOW_MAX_CALLS calls in any such window. */
export const WINDOW_MS = 30_000;
export const WINDOW_MAX_CALLS = 20;
/** A call that would wait longer than this for a slot fails fast with `rate_limited` instead of queueing. */
export const MAX_QUEUE_WAIT_MS = 4_000;
/** How long a catalogue fetch (which has a call budget) may wait for each slot. */
export const CATALOGUE_QUEUE_WAIT_MS = 30_000;
/** Spotify calls the whole app (all instances) may make per UTC day; at this count the breaker opens until midnight UTC. */
export const DAILY_MAX_CALLS = 1500;
/** A Retry-After above this opens the breaker; at or below it, the call waits once and retries once. */
export const SHORT_RETRY_AFTER_S = 30;
/** Without a Retry-After header, wait this long once. */
export const DEFAULT_RETRY_AFTER_S = 2;
/** Spotify calls one catalogue fetch may spend (album list pages + batches + track pages, retries included). */
export const CATALOGUE_CALL_BUDGET = 60;
/**
 * Wall-clock time one catalogue fetch may take. At 20 s it stops and returns the songs found so far (a partial catalogue),
 * so research step 2 stays well inside the function's 120 s (a big catalogue paced at 2 calls a second took minutes).
 */
export const CATALOGUE_DEADLINE_MS = 20_000;
const ADAPTER = "spotify";
/** How often an instance re-reads the shared row while it believes Spotify is fine. */
const RECHECK_MS = 30_000;

export interface BackoffStore {
  get(adapter: string): Promise<Date | null>;
  set(adapter: string, until: Date): Promise<void>;
}

export class MemoryBackoffStore implements BackoffStore {
  private readonly rows = new Map<string, Date>();
  async get(adapter: string) {
    return this.rows.get(adapter) ?? null;
  }
  async set(adapter: string, until: Date) {
    const old = this.rows.get(adapter);
    if (!old || old < until) this.rows.set(adapter, until);
  }
}

type Sql = ReturnType<typeof neon>;

export class PostgresBackoffStore implements BackoffStore {
  constructor(private readonly sql: Sql) {}
  async get(adapter: string) {
    const rows = (await this.sql.query("SELECT until_at FROM adapter_backoff WHERE adapter = $1 AND until_at > now()", [adapter])) as { until_at: Date | string }[];
    return rows.length > 0 ? new Date(rows[0].until_at) : null;
  }
  async set(adapter: string, until: Date) {
    await this.sql.query(
      "INSERT INTO adapter_backoff (adapter, until_at) VALUES ($1, $2) ON CONFLICT (adapter) DO UPDATE SET until_at = GREATEST(adapter_backoff.until_at, EXCLUDED.until_at), updated_at = now()",
      [adapter, until.toISOString()],
    );
  }
}

export interface UsageStore {
  /** Adds one call to the adapter's count for the UTC day (YYYY-MM-DD) and returns the new count. */
  increment(adapter: string, day: string): Promise<number>;
}

export class MemoryUsageStore implements UsageStore {
  private readonly rows = new Map<string, number>();
  async increment(adapter: string, day: string) {
    const key = `${adapter}:${day}`;
    const calls = (this.rows.get(key) ?? 0) + 1;
    this.rows.set(key, calls);
    return calls;
  }
}

export class PostgresUsageStore implements UsageStore {
  constructor(private readonly sql: Sql) {}
  async increment(adapter: string, day: string) {
    const rows = (await this.sql.query(
      "INSERT INTO adapter_usage (adapter, day, calls) VALUES ($1, $2, 1) ON CONFLICT (adapter, day) DO UPDATE SET calls = adapter_usage.calls + 1 RETURNING calls",
      [adapter, day],
    )) as { calls: number | string }[];
    return Number(rows[0].calls);
  }
}

type State = {
  untilMs: number;
  checkedAt: number;
  nextSlot: number;
  /** Start times of the calls reserved in the last WINDOW_MS, oldest first. */
  slots: number[];
  paceMs: number;
  windowMax: number;
  dailyMax: number;
  day: string;
  dayCalls: number;
  store: BackoffStore | undefined;
  usage: UsageStore | undefined;
};
const KEY = Symbol.for("buskmap:spotify-pacer");
function state(): State {
  const g = globalThis as unknown as Record<symbol, State | undefined>;
  return (g[KEY] ??= fresh({}));
}

function fresh(options: ResetOptions): State {
  return {
    untilMs: 0,
    checkedAt: 0,
    nextSlot: 0,
    slots: [],
    paceMs: options.paceMs ?? PACE_MS,
    windowMax: options.windowMax ?? WINDOW_MAX_CALLS,
    dailyMax: options.dailyMax ?? DAILY_MAX_CALLS,
    day: "",
    dayCalls: 0,
    store: options.store,
    usage: options.usage,
  };
}

function store(): BackoffStore {
  const s = state();
  if (!s.store) {
    const url = storeDatabaseUrl(false);
    s.store = url ? new PostgresBackoffStore(neon(url)) : new MemoryBackoffStore();
  }
  return s.store;
}

function usageStore(): UsageStore {
  const s = state();
  if (!s.usage) {
    const url = storeDatabaseUrl(false);
    s.usage = url ? new PostgresUsageStore(neon(url)) : new MemoryUsageStore();
  }
  return s.usage;
}

type ResetOptions = { store?: BackoffStore; usage?: UsageStore; paceMs?: number; windowMax?: number; dailyMax?: number };

/** Test hook: clears the in-process state and optionally plugs the stores and the limits. */
export function resetPacerForTests(options: ResetOptions = {}) {
  const g = globalThis as unknown as Record<symbol, State | undefined>;
  g[KEY] = fresh(options);
}

const rateLimited = (message: string) => new AdapterError("repertoire", "rate_limited", `${message} (returned HTTP 429)`, 429);

/** When Spotify may be called again, or null when it is not limited. Reads the shared row at most every 30 s. */
export async function spotifyLimitedUntil(): Promise<Date | null> {
  const s = state();
  const now = Date.now();
  if (s.untilMs > now) return new Date(s.untilMs);
  if (now - s.checkedAt >= RECHECK_MS) {
    s.checkedAt = now;
    try {
      const until = await store().get(ADAPTER);
      if (until && until.getTime() > now) s.untilMs = until.getTime();
    } catch (error) {
      // The table may not exist yet (migration pending) or the database may be down: the in-memory copy still protects this instance.
      log.warn("spotify back-off could not be read", { error: error instanceof Error ? error.message : "unknown error" });
    }
  }
  return s.untilMs > now ? new Date(s.untilMs) : null;
}

/** Opens the breaker until `until`, in memory and in the shared store. */
export async function limitSpotifyUntil(until: Date): Promise<void> {
  const s = state();
  s.untilMs = Math.max(s.untilMs, until.getTime());
  log.warn("spotify rate-limited, calls paused", { until: new Date(s.untilMs).toISOString() });
  try {
    await store().set(ADAPTER, new Date(s.untilMs));
  } catch (error) {
    log.warn("spotify back-off could not be saved", { error: error instanceof Error ? error.message : "unknown error" });
  }
}

/**
 * Waits for this call's slot: calls start at least PACE_MS (500 ms) apart and at most WINDOW_MAX_CALLS (20) in any rolling
 * WINDOW_MS (30 s), process-wide. When the slot is more than `maxWaitMs` away the call is not queued: it fails fast with
 * `rate_limited` (the same error the breaker throws).
 */
export async function paceSpotify(maxWaitMs = MAX_QUEUE_WAIT_MS): Promise<void> {
  const s = state();
  const now = Date.now();
  while (s.slots.length > 0 && s.slots[0] <= now - WINDOW_MS) s.slots.shift();
  let at = Math.max(now, s.nextSlot);
  // The window is full: the next slot opens when the call WINDOW_MAX_CALLS back leaves the window.
  if (s.slots.length >= s.windowMax) at = Math.max(at, s.slots[s.slots.length - s.windowMax] + WINDOW_MS);
  if (at - now > maxWaitMs) throw rateLimited(`Spotify is busy: the next free slot is ${Math.ceil((at - now) / 1000)} s away`);
  s.nextSlot = at + s.paceMs;
  s.slots.push(at);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

const midnightUtc = (ms: number) => {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
};

/**
 * Counts one Spotify call against today's (UTC) app-wide cap. The call that reaches DAILY_MAX_CALLS still goes out and
 * opens the breaker until the next UTC midnight; a call past it fails fast. A database error is logged and the
 * in-memory count carries on.
 */
export async function countSpotifyCall(): Promise<void> {
  const s = state();
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (s.day !== day) {
    s.day = day;
    s.dayCalls = 0;
  }
  s.dayCalls++;
  try {
    s.dayCalls = Math.max(s.dayCalls, await usageStore().increment(ADAPTER, day));
  } catch (error) {
    // The table may not exist yet (migration pending) or the database may be down: the in-memory count still caps this instance.
    log.warn("spotify usage could not be counted", { error: error instanceof Error ? error.message : "unknown error" });
  }
  if (s.dayCalls > s.dailyMax) throw rateLimited("Spotify's daily call cap for this app is reached");
  if (s.dayCalls === s.dailyMax) await limitSpotifyUntil(midnightUtc(now));
}

/** A per-fetch allowance of Spotify calls, and optionally of wall-clock time (a deadline in epoch ms). */
export class CallBudget {
  private used = 0;
  constructor(
    readonly max: number,
    readonly deadline = Number.POSITIVE_INFINITY,
  ) {}
  take() {
    if (this.used >= this.max) throw new BudgetExhausted();
    if (Date.now() >= this.deadline) throw new BudgetExhausted("deadline");
    this.used++;
  }
  get spent() {
    return this.used;
  }
  /** Time left before the deadline (Infinity without one), never negative. */
  remainingMs() {
    return Math.max(0, this.deadline - Date.now());
  }
  /** A wait (for a pacer slot or a short Retry-After) capped to the time left. */
  capWait(ms: number) {
    return Math.min(ms, this.remainingMs());
  }
}

export class BudgetExhausted extends Error {
  constructor(readonly why: "calls" | "deadline" = "calls") {
    super(why === "deadline" ? "The time for this Spotify fetch is used up" : "Spotify call budget for this fetch is used up");
    this.name = "BudgetExhausted";
  }
}
