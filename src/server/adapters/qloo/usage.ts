import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Qloo usage per busk (research totals' qlooCalls and qlooCacheHits).
 *
 * - qlooCalls: HTTP requests actually sent to Qloo (or the local mock), retries included. A cache hit sends none.
 * - qlooCacheHits: Qloo lookups (one cached data call, e.g. a heatmap or a crowd read) answered from the data cache
 *   ('use cache: remote') without any request.
 *
 * How it is counted: every cached Qloo client function is split into an exported wrapper (`countLookup`, runs in the
 * caller's request) and its 'use cache' body (`lookupScope`, runs only on a miss). Next runs a cache body in its own
 * async context, so request-scoped state can't reach it. The body therefore counts its requests in a scope of its
 * own and publishes the count under the lookup's key (name and arguments); the wrapper picks it up when the call
 * returns. A published count means a miss with that many requests; none means a cache hit.
 *
 * The busk's counter is scoped to one agent run with AsyncLocalStorage (`withQlooUsage`), so the agent's tools and
 * the engine's own loads in that run both count, and concurrent busks never mix. It is not stored on the
 * AdapterContext: that context is plain data that crosses into cached scopes, and the engine's per-request memo
 * (agent/preload.ts) shares it between busks of the same request. Data a run reuses from that in-memory memo makes
 * no lookup and counts in neither field. If two busks miss the same key at once, the requests may be credited to
 * either of them.
 */
export type QlooUsage = { calls: number; cacheHits: number };

/** One store per process, like processMap (memo.ts): Next can bundle this module more than once. */
function processSingleton<T>(name: string, make: () => T): T {
  const key = Symbol.for(`buskmap:${name}`);
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  return (store[key] ??= make());
}

type Frame = { requests: number; parent: Frame | undefined };
const busk = processSingleton("qloo-usage", () => new AsyncLocalStorage<QlooUsage>());
const scope = processSingleton("qloo-lookup", () => new AsyncLocalStorage<Frame>());
/** Misses published by cache bodies, by lookup key, until their wrapper takes them. */
const misses = processSingleton("qloo-misses", () => new Map<string, { at: number; requests: number }[]>());
const MISS_TTL_MS = 120_000;

const keyOf = (name: string, args: readonly unknown[]) => `${name}:${JSON.stringify(args)}`;

/** Run `fn` with a fresh Qloo usage counter for this busk. */
export function withQlooUsage<T>(fn: (usage: QlooUsage) => Promise<T>): Promise<T> {
  const usage: QlooUsage = { calls: 0, cacheHits: 0 };
  return busk.run(usage, () => fn(usage));
}

/** One HTTP request to Qloo is about to be sent (client.qlooGet): counted in every enclosing cache body. */
export function noteQlooRequest() {
  for (let frame = scope.getStore(); frame; frame = frame.parent) frame.requests++;
}

/** The 'use cache' body of a lookup: runs only on a miss, and publishes how many requests it sent. */
export async function lookupScope<T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> {
  const frame: Frame = { requests: 0, parent: scope.getStore() };
  try {
    return await scope.run(frame, body);
  } finally {
    const now = Date.now();
    for (const [key, list] of misses) {
      const fresh = list.filter((m) => now - m.at < MISS_TTL_MS);
      if (fresh.length) misses.set(key, fresh);
      else misses.delete(key);
    }
    const key = keyOf(name, args);
    misses.set(key, [...(misses.get(key) ?? []), { at: now, requests: frame.requests }]);
  }
}

/** The caller's side of a lookup: a published miss adds its requests to the busk, no miss is a cache hit. */
export async function countLookup<T>(name: string, args: readonly unknown[], load: () => Promise<T>): Promise<T> {
  const usage = busk.getStore();
  let ok = false;
  try {
    const result = await load();
    ok = true;
    return result;
  } finally {
    if (usage) {
      const key = keyOf(name, args);
      const list = misses.get(key);
      const miss = list?.shift();
      if (list && list.length === 0) misses.delete(key);
      if (miss) usage.calls += miss.requests;
      else if (ok) usage.cacheHits++;
    }
  }
}
