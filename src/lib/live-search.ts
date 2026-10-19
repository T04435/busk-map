/**
 * Search-as-you-type without a framework: debounce the keystrokes, cancel the
 * request a newer query makes stale (AbortController), and report one state at
 * a time. The React hook (components/forms/use-live-search.ts) is a thin wrapper.
 */

export const MIN_QUERY_CHARS = 3;
export const SEARCH_DEBOUNCE_MS = 300;

export type SearchState<T> =
  | { status: "idle"; query: string }
  | { status: "loading"; query: string }
  | { status: "done"; query: string; results: T[]; note: string | null }
  | { status: "error"; query: string; message: string };

export type SearchOutcome<T> = { results: T[]; note?: string | null };

/** Thrown by a search function to show a specific message in the error state. */
export class SearchError extends Error {}

type Options<T> = {
  search: (query: string, signal: AbortSignal) => Promise<SearchOutcome<T>>;
  onState: (state: SearchState<T>) => void;
  minChars?: number;
  delayMs?: number;
  /** Message for unexpected failures (a SearchError's own message wins). */
  errorMessage?: string;
};

export function createLiveSearch<T>({
  search,
  onState,
  minChars = MIN_QUERY_CHARS,
  delayMs = SEARCH_DEBOUNCE_MS,
  errorMessage = "Search isn't working right now. Try again in a moment.",
}: Options<T>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    inflight?.abort();
    inflight = null;
  };

  const run = async (query: string) => {
    const controller = new AbortController();
    inflight = controller;
    try {
      const outcome = await search(query, controller.signal);
      if (controller.signal.aborted) return;
      onState({ status: "done", query, results: outcome.results, note: outcome.note ?? null });
    } catch (error) {
      if (controller.signal.aborted) return;
      onState({ status: "error", query, message: error instanceof SearchError ? error.message : errorMessage });
    } finally {
      if (inflight === controller) inflight = null;
    }
  };

  return {
    /** Call on every keystroke. */
    update(raw: string) {
      cancel();
      const query = raw.trim();
      if (query.length < minChars) {
        onState({ status: "idle", query });
        return;
      }
      onState({ status: "loading", query });
      timer = setTimeout(() => {
        timer = null;
        void run(query);
      }, delayMs);
    },
    /** Drop any pending or in-flight search (unmount, or a pick that clears the box). */
    cancel,
  };
}

/** A small in-memory cache for lookups that are slow to change (e.g. listener counts). */
export function createLookupCache<V>(max = 500) {
  const values = new Map<string, V>();
  return {
    get: (key: string) => values.get(key),
    has: (key: string) => values.has(key),
    set(key: string, value: V) {
      if (values.size >= max) values.delete(values.keys().next().value as string);
      values.set(key, value);
    },
    /** The keys not cached yet. */
    missing: (keys: readonly string[]) => [...new Set(keys)].filter((k) => !values.has(k)),
  };
}

/** 215000 → "3:35". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** 1234567 → "1.2M", 45200 → "45k", 812 → "812". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
