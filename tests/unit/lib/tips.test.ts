import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_TIPS, exampleHistory, examplesForKey, exampleTipsFor } from "@/lib/example-tips";
import { EXAMPLES } from "@/lib/examples";
import { parsePlanParams } from "@/lib/plan-url";
import { parseWeekParams } from "@/lib/week-url";
import {
  encodeTipCookie,
  expectedHistory,
  historyFromCookie,
  historyKey,
  loadTips,
  parseTipsParam,
  performerKeyFor,
  saveTips,
  summariesByPerformer,
  summarizeTips,
  TIP_STORAGE_KEY,
  tipsParam,
  type TipEntry,
} from "@/lib/tips";
import { PUBLIC_SPOTS } from "@/server/data/spots";

const entry = (over: Partial<TipEntry>): TipEntry => ({
  id: Math.random().toString(36),
  performerKey: "act:jess",
  performerName: "Jess",
  pitchId: "spot:osm:a",
  pitchName: "A",
  date: "2026-10-10",
  startHour: 18,
  endHour: 21,
  amount: 90,
  example: false,
  ...over,
});

describe("summarizeTips", () => {
  it("averages takings per hour, overall and per pitch, busiest pitch first", () => {
    const history = summarizeTips([
      entry({ pitchId: "b", amount: 60, startHour: 18, endHour: 20 }),
      entry({ pitchId: "a", amount: 90 }),
      entry({ pitchId: "a", amount: 150 }),
      // A zero-length session can't be averaged and is ignored.
      entry({ pitchId: "c", amount: 50, startHour: 18, endHour: 18 }),
    ])!;
    expect(history).toEqual({
      source: "yours",
      sessions: 3,
      perHour: 37.5,
      pitches: [
        { id: "a", sessions: 2, perHour: 40 },
        { id: "b", sessions: 1, perHour: 30 },
      ],
    });
    expect(summarizeTips([])).toBeNull();
    expect(summarizeTips([entry({ example: true })])!.source).toBe("example");
    expect(summarizeTips([entry({ example: true }), entry({})])!.source).toBe("mixed");
  });
});

describe("tips encoding", () => {
  it("round-trips, including pitch ids with colons", () => {
    const history = summarizeTips([entry({ pitchId: "spot:osm:x" }), entry({ pitchId: "footpath:9", amount: 30 })])!;
    expect(parseTipsParam(tipsParam(history))).toEqual(history);
    expect(tipsParam(null)).toBeNull();
    expect(parseTipsParam(undefined)).toBeUndefined();
    expect(parseTipsParam("garbage")).toBeUndefined();
    expect(parseTipsParam("z~1~2")).toBeUndefined();
  });

  it("reads one performer's history from the cookie, and ignores a bad cookie", () => {
    const history = summarizeTips([entry({}), entry({ pitchId: "b" })])!;
    const cookie = encodeTipCookie({ "act:jess": history });
    expect(historyFromCookie(cookie, "act:jess")).toEqual(history);
    expect(historyFromCookie(cookie, "act:other")).toBeUndefined();
    expect(historyFromCookie(null, "act:jess")).toBeUndefined();
    expect(historyFromCookie("%E0%A4%A", "act:jess")).toBeUndefined();
    expect(historyFromCookie(encodeURIComponent("1"), "act:jess")).toBeUndefined();
  });

  it("keeps the cookie small: six performers, fifteen pitches each", () => {
    const many = Array.from({ length: 30 }, (_, i) => entry({ pitchId: `p${i}` }));
    const histories = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`act:${i}`, summarizeTips(many)!]));
    const cookie = encodeTipCookie(histories);
    expect(historyFromCookie(cookie, "act:0")).toBeUndefined();
    expect(historyFromCookie(cookie, "act:7")!.pitches).toHaveLength(15);
    expect(cookie.length).toBeLessThan(4000);
  });
});

describe("performer keys and expected history", () => {
  it("keys example performers by id and own acts by name", () => {
    expect(performerKeyFor("Anything", "sax")).toBe("example:sax");
    expect(performerKeyFor("  Jess On Guitar ", null)).toBe("act:jess on guitar");
  });

  it("mixes an example performer's sessions with the browser's own, most recent performer last", () => {
    const own = [entry({ performerKey: "example:sax", performerName: "Sax", pitchId: "spot:osm:cohen-place-plaza", amount: 300, startHour: 17, endHour: 20 }), entry({})];
    const byPerformer = summariesByPerformer(own, examplesForKey);
    expect(Object.keys(byPerformer)).toEqual(["example:sax", "act:jess"]);
    expect(byPerformer["example:sax"].source).toBe("mixed");
    expect(byPerformer["example:sax"].sessions).toBe(exampleTipsFor("sax").length + 1);
    expect(byPerformer["act:jess"].source).toBe("yours");
    expect(historyKey(expectedHistory(own, "example:sax", examplesForKey))).toBe(historyKey(byPerformer["example:sax"]));
    expect(expectedHistory([], "act:nobody", examplesForKey)).toBeUndefined();
    expect(historyKey(undefined)).toBe("");
  });
});

describe("example tip data", () => {
  it("is labelled example data, on real pitches, for every example performer", () => {
    const spotIds = new Set(PUBLIC_SPOTS.map((s) => `spot:${s.id}`));
    for (const example of EXAMPLES) {
      const seeds = exampleTipsFor(example.id);
      expect(seeds.length).toBeGreaterThanOrEqual(5);
      expect(seeds.every((s) => s.example && spotIds.has(s.pitchId))).toBe(true);
      expect(exampleHistory(example.id)!.source).toBe("example");
    }
    expect(EXAMPLE_TIPS.every((e) => e.example)).toBe(true);
    expect(exampleHistory(null)).toBeUndefined();
  });

  it("is the default history for example plans and weeks, and a cookie overrides it", () => {
    const plan = parsePlanParams({ example: "acoustic" }, "2026-10-15");
    expect(plan.ok && plan.request.history).toEqual(exampleHistory("acoustic"));
    const own = summarizeTips([entry({ performerKey: "example:acoustic" }), entry({ performerKey: "example:acoustic", pitchId: "b" })])!;
    const cookie = encodeTipCookie({ "example:acoustic": own });
    const fromCookie = parsePlanParams({ example: "acoustic" }, "2026-10-15", cookie);
    expect(fromCookie.ok && fromCookie.request.history).toEqual(own);
    // Own acts have no history without a cookie.
    const act = parsePlanParams({ name: "Jess", artists: "Paul Kelly" }, "2026-10-15");
    expect(act.ok && act.request.history).toBeUndefined();
    const week = parseWeekParams({ example: "sax" }, "2026-10-15");
    expect(week.ok && week.request.history).toEqual(exampleHistory("sax"));
    const actWeek = parseWeekParams({ name: "Jess", artists: "Paul Kelly" }, "2026-10-15", encodeTipCookie({ "act:jess": own }));
    expect(actWeek.ok && actWeek.request.history).toEqual(own);
  });
});

describe("browser storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBrowser(initial: string | null, { throwOnSet = false } = {}) {
    const store = new Map<string, string>(initial === null ? [] : [[TIP_STORAGE_KEY, initial]]);
    const cookies: string[] = [];
    const events: string[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (throwOnSet) throw new Error("QuotaExceededError");
          store.set(k, v);
        },
      },
      location: { protocol: "https:" },
      dispatchEvent: (e: Event) => events.push(e.type),
    });
    vi.stubGlobal("document", {
      set cookie(value: string) {
        cookies.push(value);
      },
    });
    return { store, cookies, events };
  }

  it("loads only valid, non-example entries", () => {
    stubBrowser(JSON.stringify([entry({ id: "ok" }), entry({ id: "ex", example: true }), { bad: true }]));
    expect(loadTips().map((e) => e.id)).toEqual(["ok"]);
    stubBrowser("not json");
    expect(loadTips()).toEqual([]);
    stubBrowser(JSON.stringify({}));
    expect(loadTips()).toEqual([]);
    stubBrowser(null);
    expect(loadTips()).toEqual([]);
  });

  it("saves own entries, writes the cookie and announces the change", () => {
    const { store, cookies, events } = stubBrowser(null);
    expect(saveTips([entry({ id: "a" }), entry({ id: "ex", example: true })], examplesForKey)).toBe(true);
    expect(JSON.parse(store.get(TIP_STORAGE_KEY)!).map((e: TipEntry) => e.id)).toEqual(["a"]);
    expect(cookies[0]).toMatch(/^buskmap_tips=.+; Path=\/; SameSite=Lax; Max-Age=31536000; Secure$/);
    expect(events).toEqual(["buskmap:tips"]);
    // An empty log clears the cookie.
    saveTips([], examplesForKey);
    expect(cookies[1]).toMatch(/^buskmap_tips=; Path=\/; SameSite=Lax; Max-Age=0/);
  });

  it("reports a browser that refuses to save", () => {
    stubBrowser(null, { throwOnSet: true });
    expect(saveTips([entry({})], examplesForKey)).toBe(false);
  });
});
