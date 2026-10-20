import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cacheBody, cachedCall, noteRequest, safeParams } from "../call-log";

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

const busk = processSingleton("qloo-usage", () => new AsyncLocalStorage<QlooUsage>());

/** Run `fn` with a fresh Qloo usage counter for this busk. */
export function withQlooUsage<T>(fn: (usage: QlooUsage) => Promise<T>): Promise<T> {
  const usage: QlooUsage = { calls: 0, cacheHits: 0 };
  return busk.run(usage, () => fn(usage));
}

/** One HTTP request to Qloo is about to be sent (client.qlooGet): counted in every enclosing cache body. */
export const noteQlooRequest = noteRequest;

/** The 'use cache' body of a lookup: runs only on a miss, and publishes how many requests it sent (and the calls, call-log.ts). */
export function lookupScope<T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> {
  return cacheBody(`qloo.${name}`, args, body);
}

/** The Qloo path a lookup stands for, for a cache hit this instance never saw sent. */
const ENDPOINT: Record<string, string> = { searchArtist: "/search", entitiesBySpotifyIds: "/entities", entityDetail: "/entities", searchGenreTags: "/v2/tags" };

/** The caller's side of a lookup: a published miss adds its requests to the busk, no miss is a cache hit. */
export function countLookup<T>(name: string, args: readonly unknown[], load: () => Promise<T>): Promise<T> {
  const usage = busk.getStore();
  // args[0] is the backend ("live" or "mock"): not a parameter Qloo sees.
  const describe = { endpoint: ENDPOINT[name] ?? "/v2/insights", params: safeParams(args.slice(1).map((v, i): [string, unknown] => [`${name}.${i + 1}`, v])) };
  return cachedCall("qloo", `qloo.${name}`, args, load, describe, (miss, ok) => {
    if (!usage) return;
    if (miss) usage.calls += miss.requests;
    else if (ok) usage.cacheHits++;
  });
}
