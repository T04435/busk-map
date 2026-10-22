import "server-only";
import { neon } from "@neondatabase/serverless";
import { storeDatabaseUrl } from "@/server/env";
import { log } from "@/server/log";
import { AdapterError } from "../core";
import { MemoryUsageStore, PostgresUsageStore, type UsageStore } from "../repertoire/pacer";

/**
 * Busk Map's own daily Qloo budget. Every live HTTP request to Qloo (retries included; cache hits and the local mock send
 * none) is counted per UTC day, app-wide, in `adapter_usage` (migrations/012, adapter "qloo"), the table the Spotify pacer
 * uses. At QLOO_DAILY_BUDGET (default 2,000) a further request fails fast with `rate_limited` instead of reaching Qloo, so
 * the hackathon key's 10,000 a month are not spent by one busy day. Answers already in the data cache still serve, which
 * is why the example plans keep working. Instances also count in memory, so a database error never stops the count.
 */
export const DEFAULT_QLOO_DAILY_BUDGET = 2000;

/** The budget from QLOO_DAILY_BUDGET: a positive whole number, else the default. */
export function parseBudget(value: string | undefined): number {
  const n = Number(value?.trim());
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_QLOO_DAILY_BUDGET;
}

export { QLOO_BUDGET_MESSAGE } from "@/lib/qloo-budget-copy";

type State = { day: string; calls: number; spent: boolean; usage: UsageStore | undefined; max: number | undefined };
const KEY = Symbol.for("buskmap:qloo-budget");
function state(): State {
  const g = globalThis as unknown as Record<symbol, State | undefined>;
  return (g[KEY] ??= { day: "", calls: 0, spent: false, usage: undefined, max: undefined });
}

/** Test hook: clears the in-process count and plugs a store and a budget. */
export function resetQlooBudgetForTests(options: { usage?: UsageStore; max?: number } = {}) {
  const g = globalThis as unknown as Record<symbol, State | undefined>;
  g[KEY] = { day: "", calls: 0, spent: false, usage: options.usage, max: options.max };
}

function usageStore(): UsageStore {
  const s = state();
  if (!s.usage) {
    const url = storeDatabaseUrl(false);
    s.usage = url ? new PostgresUsageStore(neon(url)) : new MemoryUsageStore();
  }
  return s.usage;
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function rollDay(s: State, now: number) {
  const day = dayOf(now);
  if (s.day !== day) Object.assign(s, { day, calls: 0, spent: false });
}

/** Counts one live Qloo request against today's budget; throws `rate_limited` (HTTP 429 in the message, like the Spotify cap) once it is spent. */
export async function takeQlooCall(now = Date.now()): Promise<void> {
  const s = state();
  const max = s.max ?? parseBudget(process.env.QLOO_DAILY_BUDGET);
  rollDay(s, now);
  s.calls++;
  try {
    s.calls = Math.max(s.calls, await usageStore().increment("qloo", s.day));
  } catch (error) {
    // The table may not exist yet or the database may be down: the in-memory count still caps this instance.
    log.warn("qloo usage could not be counted", { error: error instanceof Error ? error.message : "unknown error" });
  }
  if (s.calls >= max) s.spent = true;
  if (s.calls > max) throw new AdapterError("qloo", "rate_limited", "Busk Map's daily Qloo budget is spent (returned HTTP 429)", 429);
}

/** Whether this instance has seen today's Qloo budget run out. */
export function qlooBudgetSpent(now = Date.now()): boolean {
  const s = state();
  rollDay(s, now);
  return s.spent;
}
