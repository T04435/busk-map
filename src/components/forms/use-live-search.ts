"use client";

import { useEffect, useState } from "react";
import { createLiveSearch, type SearchOutcome, type SearchState } from "@/lib/live-search";

/**
 * Debounced, cancellable search-as-you-type (see lib/live-search.ts).
 * `search` must be stable (a module-level function): it is read once.
 */
export function useLiveSearch<T>(search: (query: string, signal: AbortSignal) => Promise<SearchOutcome<T>>) {
  const [state, setState] = useState<SearchState<T>>({ status: "idle", query: "" });
  const [live] = useState(() => createLiveSearch<T>({ search, onState: setState }));
  useEffect(() => () => live.cancel(), [live]);
  return { state, update: live.update, cancel: live.cancel };
}
