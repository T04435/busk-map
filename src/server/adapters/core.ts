import "server-only";
import type { z } from "zod";
import type { SourceId } from "@/lib/sources";
import { log, redactUrl } from "@/server/log";

/**
 * Shared adapter plumbing (architecture.md, principle 2): every source has a
 * typed client, response validation, a timeout, a cache policy and a defined
 * fallback. A failing source lowers precision but never breaks the page.
 */

export type AdapterName =
  | "qloo"
  | "pitches"
  | "events"
  | "songs"
  | "repertoire"
  | "weather";

export const ADAPTER_NAMES: readonly AdapterName[] = [
  "qloo",
  "pitches",
  "events",
  "songs",
  "repertoire",
  "weather",
];

export type AdapterErrorKind =
  | "missing_key"
  | "timeout"
  | "http"
  | "rate_limited"
  | "invalid_response"
  | "not_found"
  | "network"
  | "fault_injected";

export class AdapterError extends Error {
  readonly kind: AdapterErrorKind;
  readonly adapter: AdapterName;
  readonly status?: number;
  /** Seconds the provider asked us to wait (the Retry-After header of a 429), when it sent one. */
  readonly retryAfterSeconds?: number;

  constructor(adapter: AdapterName, kind: AdapterErrorKind, message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "AdapterError";
    this.adapter = adapter;
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * How a result was produced:
 * - live: from the provider (possibly via cache)
 * - synthetic: from labelled synthetic fixtures (offline mode, or Qloo before its key arrives)
 * - fallback: the provider failed or is unconfigured; `data` is the adapter's defined fallback
 */
export type AdapterMode = "live" | "synthetic" | "fallback";

export type AdapterResult<T> = {
  adapter: AdapterName;
  source: SourceId;
  mode: AdapterMode;
  data: T;
  /** Why we fell back. Safe to show in the UI. */
  reason?: AdapterErrorKind;
};

/** Per-request switches. Plain data so it can cross into cached scopes. */
export type AdapterContext = {
  /** Serve synthetic fixtures for every provider (e2e, CI). */
  offline: boolean;
  /** Adapters to treat as down (e2e fault injection; never in production). */
  faults: readonly AdapterName[];
};

export const LIVE_CONTEXT: AdapterContext = { offline: false, faults: [] };

type FetchJsonOptions<S extends z.ZodType> = {
  adapter: AdapterName;
  schema: S;
  timeoutMs: number;
  init?: RequestInit;
  /** Defaults to the global fetch. The Qloo mock passes an in-process fetch. */
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
};

/**
 * Fetch JSON with a timeout and validate it. Throws AdapterError on any
 * failure; callers decide the fallback. Logs never include the query string.
 */
export async function fetchJson<S extends z.ZodType>(
  url: string,
  { adapter, schema, timeoutMs, init, fetcher = fetch }: FetchJsonOptions<S>,
): Promise<z.infer<S>> {
  const started = Date.now();
  let response: Response;
  try {
    response = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AdapterError(
      adapter,
      timedOut ? "timeout" : "network",
      timedOut ? `${redactUrl(url)} timed out after ${timeoutMs} ms` : `${redactUrl(url)} could not be reached`,
    );
  }

  if (!response.ok) {
    const kind: AdapterErrorKind =
      response.status === 429 ? "rate_limited" : response.status === 404 ? "not_found" : "http";
    const retryAfter = kind === "rate_limited" ? Number(response.headers?.get("retry-after")) : NaN;
    throw new AdapterError(
      adapter,
      kind,
      `${redactUrl(url)} returned HTTP ${response.status}`,
      response.status,
      Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : undefined,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AdapterError(adapter, "invalid_response", `${redactUrl(url)} did not return JSON`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Paths only: never the payload.
    const paths = parsed.error.issues.slice(0, 5).map((issue) => issue.path.join(".") || "(root)");
    throw new AdapterError(
      adapter,
      "invalid_response",
      `${redactUrl(url)} returned an unexpected shape at ${paths.join(", ")}`,
    );
  }

  log.debug("adapter fetch", { adapter, url: redactUrl(url), ms: Date.now() - started });
  return parsed.data;
}

type RunAdapterOptions<T> = {
  adapter: AdapterName;
  source: SourceId;
  context: AdapterContext;
  /** Synthetic fixture data for offline mode. */
  synthetic: () => T | Promise<T>;
  /** The defined fallback when the provider is unavailable. */
  fallback: T;
  /** False when the provider's credentials are missing. */
  configured?: boolean;
  /** What to do when unconfigured: fall back (default), or serve synthetic data (Qloo before its key). */
  whenUnconfigured?: "fallback" | "synthetic";
  live: () => Promise<T>;
};

/** Run one adapter call and turn every failure into its defined fallback. */
export async function runAdapter<T>({
  adapter,
  source,
  context,
  synthetic,
  fallback,
  configured = true,
  whenUnconfigured = "fallback",
  live,
}: RunAdapterOptions<T>): Promise<AdapterResult<T>> {
  if (context.faults.includes(adapter)) {
    log.warn("adapter fault injected", { adapter });
    return { adapter, source, mode: "fallback", data: fallback, reason: "fault_injected" };
  }
  if (context.offline || (!configured && whenUnconfigured === "synthetic")) {
    return { adapter, source, mode: "synthetic", data: await synthetic() };
  }
  if (!configured) {
    return { adapter, source, mode: "fallback", data: fallback, reason: "missing_key" };
  }
  try {
    return { adapter, source, mode: "live", data: await live() };
  } catch (error) {
    const kind = errorKindOf(error);
    log.error("adapter failed, using fallback", {
      adapter,
      kind,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { adapter, source, mode: "fallback", data: fallback, reason: kind };
  }
}

/**
 * The kind of a failure. Errors thrown inside `"use cache"` functions reach us without their class
 * (the cache serialises them), so an AdapterError's kind is recovered from its message as a fallback.
 */
export function errorKindOf(error: unknown): AdapterErrorKind {
  if (error instanceof AdapterError) return error.kind;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const status = /returned HTTP (\d{3})/.exec(message)?.[1];
  if (status === "404") return "not_found";
  if (status === "429") return "rate_limited";
  if (status) return "http";
  if (/timed out after/.test(message)) return "timeout";
  if (/is not configured|are not configured/.test(message)) return "missing_key";
  if (/returned an unexpected shape|did not return JSON/i.test(message)) return "invalid_response";
  return "network";
}

/** Like Promise.allSettled over `items.map(fn)`, but at most `limit` calls at a time (polite to rate-limited APIs). */
export async function settleWithLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
