import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRecentPlans, MAX_RECENT_PLANS, RECENT_PLANS_KEY, rememberPlan } from "@/lib/recent-plans";

function stubBrowser(initial: string | null, { throwOnSet = false } = {}) {
  const store = new Map<string, string>(initial === null ? [] : [[RECENT_PLANS_KEY, initial]]);
  const events: string[] = [];
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (throwOnSet) throw new Error("QuotaExceededError");
        store.set(k, v);
      },
    },
    dispatchEvent: (e: Event) => events.push(e.type),
  });
  return { store, events };
}

const plan = (name: string, date = "2026-10-17", pitches = [{ id: "spot:osm:a", name: "A" }]) => ({
  performerName: name,
  exampleId: null,
  slot: { date, startHour: 18, endHour: 21 },
  pitches,
});

describe("recent plans", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers a plan with its pitches, newest first, and says so", () => {
    const { events } = stubBrowser(null);
    rememberPlan(plan("Jess"));
    rememberPlan(plan("Sam", "2026-10-18", [{ id: "spot:osm:b", name: "B" }]));
    const plans = loadRecentPlans();
    expect(plans.map((p) => p.performerName)).toEqual(["Sam", "Jess"]);
    expect(plans[1]).toMatchObject({ performerKey: "act:jess", date: "2026-10-17", startHour: 18, endHour: 21, pitches: [{ id: "spot:osm:a", name: "A" }] });
    expect(events).toEqual(["buskmap:recent-plans", "buskmap:recent-plans"]);
  });

  it("keys an example act by its example id, and replaces a plan opened again", () => {
    stubBrowser(null);
    rememberPlan({ ...plan("Folk duo"), exampleId: "folk-duo" });
    rememberPlan({ ...plan("Folk duo"), exampleId: "folk-duo", pitches: [{ id: "spot:osm:z", name: "Z" }] });
    const plans = loadRecentPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].performerKey).toBe("example:folk-duo");
    expect(plans[0].pitches).toEqual([{ id: "spot:osm:z", name: "Z" }]);
  });

  it("keeps the latest few", () => {
    stubBrowser(null);
    for (let i = 0; i < MAX_RECENT_PLANS + 3; i++) rememberPlan(plan(`Act ${i}`));
    const plans = loadRecentPlans();
    expect(plans).toHaveLength(MAX_RECENT_PLANS);
    expect(plans[0].performerName).toBe(`Act ${MAX_RECENT_PLANS + 2}`);
  });

  it("ignores a plan with no pitches, and survives bad or blocked storage", () => {
    const { store } = stubBrowser("not json");
    expect(loadRecentPlans()).toEqual([]);
    rememberPlan(plan("Nobody", "2026-10-17", []));
    expect(store.get(RECENT_PLANS_KEY)).toBe("not json");
    stubBrowser(JSON.stringify([{ bad: true }]));
    expect(loadRecentPlans()).toEqual([]);
    stubBrowser(null, { throwOnSet: true });
    expect(() => rememberPlan(plan("Jess"))).not.toThrow();
  });
});
