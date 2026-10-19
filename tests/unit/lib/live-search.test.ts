import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveSearch, createLookupCache, formatCount, formatDuration, SearchError, type SearchState } from "@/lib/live-search";
import { learnLinks } from "@/lib/learn-links";

describe("createLiveSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  type Search = (q: string, signal: AbortSignal) => Promise<{ results: string[]; note?: string | null }>;
  function setup(search: Search & ReturnType<typeof vi.fn> = vi.fn(async (q: string) => ({ results: [q.toUpperCase()] }))) {
    const states: SearchState<string>[] = [];
    const live = createLiveSearch<string>({ search, onState: (s) => states.push(s) });
    return { live, search, states, last: () => states[states.length - 1] };
  }

  it("waits for three characters", () => {
    const { live, search, last } = setup();
    live.update("ab ");
    expect(last()).toEqual({ status: "idle", query: "ab" });
    vi.advanceTimersByTime(1000);
    expect(search).not.toHaveBeenCalled();
  });

  it("debounces keystrokes into one request, about 300 ms after the last", async () => {
    const { live, search, last } = setup();
    live.update("pau");
    vi.advanceTimersByTime(200);
    live.update("paul");
    expect(last()).toEqual({ status: "loading", query: "paul" });
    vi.advanceTimersByTime(299);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0]).toBe("paul");
    expect(last()).toEqual({ status: "done", query: "paul", results: ["PAUL"], note: null });
  });

  it("aborts a stale request and ignores its answer", async () => {
    const resolvers: ((v: { results: string[] }) => void)[] = [];
    const signals: AbortSignal[] = [];
    const search = vi.fn((_q: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<{ results: string[] }>((resolve) => resolvers.push(resolve));
    });
    const { live, last, states } = setup(search);
    live.update("first");
    await vi.advanceTimersByTimeAsync(300);
    live.update("second");
    expect(signals[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    resolvers[0]({ results: ["stale"] });
    resolvers[1]({ results: ["fresh"] });
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toMatchObject({ status: "done", query: "second", results: ["fresh"] });
    expect(states.some((s) => s.status === "done" && s.results.includes("stale"))).toBe(false);
  });

  it("reports errors, with a SearchError's own message, but not for aborted requests", async () => {
    const { live, last } = setup(vi.fn(async () => Promise.reject(new SearchError("Too many searches"))));
    live.update("abc");
    await vi.advanceTimersByTimeAsync(300);
    expect(last()).toEqual({ status: "error", query: "abc", message: "Too many searches" });

    const other = setup(vi.fn(async () => Promise.reject(new Error("boom"))));
    other.live.update("abc");
    await vi.advanceTimersByTimeAsync(300);
    expect(other.last()).toMatchObject({ status: "error", message: expect.stringContaining("isn't working") });

    const aborted = setup(
      vi.fn((_q: string, signal: AbortSignal) => new Promise<{ results: string[] }>((_r, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))))),
    );
    aborted.live.update("abc");
    await vi.advanceTimersByTimeAsync(300);
    aborted.live.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(aborted.last()).toEqual({ status: "loading", query: "abc" });
  });

  it("passes a result note through, and cancel drops a pending search", async () => {
    const { live, search, last } = setup(vi.fn(async () => ({ results: [], note: "Offline test data" })));
    live.update("abc");
    await vi.advanceTimersByTimeAsync(300);
    expect(last()).toEqual({ status: "done", query: "abc", results: [], note: "Offline test data" });
    live.update("abcd");
    live.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe("createLookupCache", () => {
  it("caches values, lists missing keys and evicts the oldest", () => {
    const cache = createLookupCache<number | null>(2);
    cache.set("a", 1);
    cache.set("b", null);
    expect(cache.has("b")).toBe(true);
    expect(cache.get("a")).toBe(1);
    expect(cache.missing(["a", "c", "c"])).toEqual(["c"]);
    cache.set("c", 3);
    expect(cache.has("a")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats durations as m:ss", () => {
    expect(formatDuration(215_000)).toBe("3:35");
    expect(formatDuration(59_600)).toBe("1:00");
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });

  it("formats counts compactly", () => {
    expect(formatCount(812)).toBe("812");
    expect(formatCount(45_200)).toBe("45k");
    expect(formatCount(1_234_567)).toBe("1.2M");
    expect(formatCount(2_000_000)).toBe("2M");
    expect(formatCount(12_345_678)).toBe("12M");
  });
});

describe("learnLinks", () => {
  it("builds karaoke, chords and lyrics searches", () => {
    const links = learnLinks("How to Make Gravy", "Paul Kelly");
    expect(links.map((l) => l.id)).toEqual(["karaoke", "chords", "lyrics"]);
    expect(links[0].href).toBe("https://www.youtube.com/results?search_query=How+to+Make+Gravy+Paul+Kelly+karaoke");
    expect(links[1].href).toBe("https://www.ultimate-guitar.com/search.php?search_type=title&value=How+to+Make+Gravy+Paul+Kelly");
    expect(links[2].href).toBe("https://genius.com/search?q=How+to+Make+Gravy+Paul+Kelly");
    expect(learnLinks("Solo", " ")[2].href).toBe("https://genius.com/search?q=Solo");
  });
});
