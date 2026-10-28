import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { MAX_CALLS_PER_STEP, type CallRecord } from "@/lib/call-record";
import { processMap } from "@/server/memo";

/**
 * Every external call a research step makes (Qloo, Spotify, Last.fm), recorded for the step's RAW panel.
 *
 * - `recordCalls(list, fn)` runs `fn` with `list` as the sink: every call made inside it lands in the list.
 * - `fetchJson` (core.ts) notes each HTTP request it sends: provider, path, the parameters with keys and tokens stripped,
 *   the status, a result count and the time.
 * - Cached client functions are split in two: the caller's side (`cachedCall`) and the 'use cache' body (`cacheBody`). Next runs
 *   a cache body in its own async context, so the body collects its requests in a frame of its own and publishes them under the
 *   lookup's key (name and arguments); the caller's side picks them up when the call returns. Nothing published means the data
 *   cache answered: that is recorded as a cached call, with the endpoint and parameters this instance saw last for the key.
 * - Offline, Spotify and Last.fm read fixtures (no request): runAdapter notes those with status null.
 *
 * The Qloo usage counter (qloo/usage.ts) rides on the same frames.
 */

function processSingleton<T>(name: string, make: () => T): T {
  const key = Symbol.for(`buskmap:${name}`);
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  return (store[key] ??= make());
}

type Frame = { requests: number; calls: CallRecord[]; parent: Frame | undefined };
type Miss = { at: number; requests: number; calls: CallRecord[] };

const sink = processSingleton("call-log-sink", () => new AsyncLocalStorage<CallRecord[]>());
const scope = processSingleton("call-log-frame", () => new AsyncLocalStorage<Frame>());
/** Misses published by cache bodies, by lookup key, until their caller takes them. */
const misses = processMap<string, Miss[]>("call-log-misses");
/** The calls last seen for a lookup key, so a cache hit can say which endpoint it stands for. */
const seen = processMap<string, CallRecord[]>("call-log-seen");
const MISS_TTL_MS = 120_000;
const SEEN_MAX = 500;

export const lookupKey = (name: string, args: readonly unknown[]) => `${name}:${JSON.stringify(args)}`;

/** Run `fn` with `list` collecting every external call made inside it. */
export function recordCalls<T>(list: CallRecord[], fn: () => Promise<T>): Promise<T> {
  return sink.run(list, fn);
}

/** One external call happened: into the enclosing cache body's frame, else the caller's list (if anyone is recording). */
export function noteCall(call: CallRecord) {
  const frame = scope.getStore();
  if (frame) {
    frame.calls.push(call);
    return;
  }
  const list = sink.getStore();
  if (list && list.length < MAX_CALLS_PER_STEP) list.push(call);
}

/** One HTTP request is about to be sent: counted in every enclosing cache body (the Qloo usage counter reads it). */
export function noteRequest() {
  for (let frame = scope.getStore(); frame; frame = frame.parent) frame.requests++;
}

/** The 'use cache' body of a lookup: runs only on a miss, and publishes what it sent. */
export async function cacheBody<T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> {
  const frame: Frame = { requests: 0, calls: [], parent: scope.getStore() };
  try {
    return await scope.run(frame, body);
  } finally {
    const now = Date.now();
    for (const [key, list] of misses) {
      const fresh = list.filter((m) => now - m.at < MISS_TTL_MS);
      if (fresh.length) misses.set(key, fresh);
      else misses.delete(key);
    }
    const key = lookupKey(name, args);
    misses.set(key, [...(misses.get(key) ?? []), { at: now, requests: frame.requests, calls: frame.calls }]);
  }
}

const SECRET = /key|token|secret|signature|sig$|auth|password|credential/i;

/** Parameters as the RAW table shows them: strings, keys and tokens left out, long values cut. */
export function safeParams(entries: Iterable<[string, unknown]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (SECRET.test(k) || v === undefined || v === null || v === "") continue;
    const text = typeof v === "string" ? v : JSON.stringify(v);
    out[k] = text.length > 160 ? `${text.slice(0, 157)}...` : text;
  }
  return out;
}

const COUNT_KEYS = ["results", "entities", "tags", "items", "artists", "tracks", "albums", "similarartists", "toptags", "toptracks", "artist", "tag", "track", "data"];

/** How many results a response (or a lookup's value) holds: its first list, else 1 for a single record, 0 for nothing. */
export function resultCount(value: unknown, depth = 0): number | null {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value !== "object") return 1;
  if (depth >= 3) return null;
  const obj = value as Record<string, unknown>;
  for (const k of COUNT_KEYS) {
    if (k in obj) {
      const n = resultCount(obj[k], depth + 1);
      if (n !== null) return n;
    }
  }
  return Object.keys(obj).length ? 1 : 0;
}

/**
 * The caller's side of a cached lookup. A published miss: its calls are the step's (sent now). None: the data cache answered,
 * recorded as one cached call. `settled` tells the Qloo usage counter which it was.
 */
export async function cachedCall<T>(
  provider: string,
  name: string,
  args: readonly unknown[],
  load: () => Promise<T>,
  describe: { endpoint: string; params: Record<string, string> },
  settled?: (miss: { requests: number } | null, ok: boolean) => void,
): Promise<T> {
  const started = Date.now();
  let ok = false;
  let value: T | undefined;
  try {
    value = await load();
    ok = true;
    return value;
  } finally {
    const key = lookupKey(name, args);
    const list = misses.get(key);
    const miss = list?.shift() ?? null;
    if (list && list.length === 0) misses.delete(key);
    settled?.(miss, ok);
    if (miss) {
      for (const call of miss.calls) noteCall(call);
      if (miss.calls.length) {
        if (seen.size >= SEEN_MAX) seen.delete(seen.keys().next().value as string);
        seen.set(key, miss.calls.slice(0, 4));
      }
    } else if (ok) {
      const ms = Date.now() - started;
      const before = seen.get(key);
      if (before?.length) for (const call of before) noteCall({ ...call, ms, cached: true });
      else noteCall({ provider, endpoint: describe.endpoint, params: describe.params, status: null, count: resultCount(value), ms, cached: true });
    }
  }
}

/** The provider name a call record carries, from the adapter that made it. */
export function providerOf(adapter: string): string {
  return adapter === "songs" ? "lastfm" : adapter === "repertoire" ? "spotify" : adapter;
}

/** An HTTP request fetchJson sent (or tried to): endpoint and parameters from the URL, keys and tokens stripped. */
export function noteFetch(adapter: string, url: string, status: number | null, body: unknown, ms: number) {
  let endpoint = url;
  let params: Record<string, string> = {};
  try {
    const u = new URL(url);
    const method = u.searchParams.get("method");
    // Last.fm names its endpoints in `method` (artist.getsimilar); the path is the same for all of them.
    // NotOnQ's drop-in proxy serves Qloo's paths under /q (or /q/app/<label>): recorded as the Qloo endpoint they stand for.
    const path = u.pathname.replace(/^\/v1(?=\/)/, "");
    endpoint = method ? method : adapter === "qloo" ? path.replace(/^\/q(?:\/app\/[^/]+)?(?=\/)/, "") : path;
    params = safeParams([...u.searchParams.entries()].filter(([k]) => k !== "method" && k !== "format"));
  } catch {
    // not a URL: keep it as it is
  }
  noteCall({ provider: providerOf(adapter), endpoint, params, status, count: status !== null && status < 400 ? resultCount(body) : 0, ms: Math.max(0, Math.round(ms)), cached: false });
}
