import "server-only";
import { neon } from "@neondatabase/serverless";
import { storeDatabaseUrl } from "@/server/env";
import { log } from "@/server/log";

/**
 * Spotify politeness (U34, 19 Oct 2026: the app was limited for about 20 h after a 256-release catalogue run).
 * - Pacer: every Spotify call in this process starts at least PACE_MS after the previous one (about 4 a second).
 * - Circuit breaker: a 429 with a long Retry-After records "limited until T"; every later call fails fast (no network)
 *   until T. T is kept in memory and in the `adapter_backoff` row (migrations/011), so a restart or another instance
 *   respects it. Without a database (offline, tests) it stays in memory.
 */
export const PACE_MS = 250;
/** A Retry-After above this opens the breaker; at or below it, the call waits once and retries once. */
export const SHORT_RETRY_AFTER_S = 30;
/** Without a Retry-After header, wait this long once. */
export const DEFAULT_RETRY_AFTER_S = 2;
/** Spotify calls one catalogue fetch may spend (album list pages + batches + track pages, retries included). */
export const CATALOGUE_CALL_BUDGET = 60;
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

type State = { untilMs: number; checkedAt: number; nextSlot: number; paceMs: number; store: BackoffStore | undefined };
const KEY = Symbol.for("buskmap:spotify-pacer");
function state(): State {
  const g = globalThis as unknown as Record<symbol, State | undefined>;
  return (g[KEY] ??= { untilMs: 0, checkedAt: 0, nextSlot: 0, paceMs: PACE_MS, store: undefined });
}

function store(): BackoffStore {
  const s = state();
  if (!s.store) {
    const url = storeDatabaseUrl(false);
    s.store = url ? new PostgresBackoffStore(neon(url)) : new MemoryBackoffStore();
  }
  return s.store;
}

/** Test hook: clears the in-process state and optionally plugs a store. */
export function resetPacerForTests(options: { store?: BackoffStore; paceMs?: number } = {}) {
  const g = globalThis as unknown as Record<symbol, State | undefined>;
  g[KEY] = { untilMs: 0, checkedAt: 0, nextSlot: 0, paceMs: options.paceMs ?? PACE_MS, store: options.store };
}

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

/** Waits for this call's slot: calls start at least PACE_MS (250 ms) apart, process-wide. */
export async function paceSpotify(): Promise<void> {
  const s = state();
  const now = Date.now();
  const at = Math.max(now, s.nextSlot);
  s.nextSlot = at + s.paceMs;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

/** A per-fetch allowance of Spotify calls. */
export class CallBudget {
  private used = 0;
  constructor(readonly max: number) {}
  take() {
    if (this.used >= this.max) throw new BudgetExhausted();
    this.used++;
  }
  get spent() {
    return this.used;
  }
}

export class BudgetExhausted extends Error {
  constructor() {
    super("Spotify call budget for this fetch is used up");
    this.name = "BudgetExhausted";
  }
}
