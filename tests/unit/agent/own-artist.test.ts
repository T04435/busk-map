import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { mockId } from "@/server/qloo-mock/catalog";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * Profile signal (features 3 and 4): the act's own Qloo artist joins the taste signal and its fans' lean is read, with the Qloo
 * mock and the mock model. The data cache is emulated like fill-qloo-usage.test.ts (every cached client body memoised by name+args).
 */
const cache = new Map<string, Promise<unknown>>();
vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return {
    ...original,
    lookupScope: <T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> => {
      const key = JSON.stringify([name, args]);
      if (!cache.has(key)) cache.set(key, original.lookupScope(name, args, body).catch((e) => (cache.delete(key), Promise.reject(e))));
      return cache.get(key) as Promise<T>;
    },
  };
});

/** Heatmap calls (ids) seen by the client, to check the signal and its order. */
const heatmapIds: string[][] = [];
let heatmapEmptyFor: string | null = null;
vi.mock("@/server/adapters/qloo/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/client")>();
  return {
    ...original,
    heatmap: (backend: Parameters<typeof original.heatmap>[0], ids: string[], area: Parameters<typeof original.heatmap>[2]) => {
      heatmapIds.push(ids);
      if (heatmapEmptyFor && ids.includes(heatmapEmptyFor)) return Promise.resolve([]);
      return original.heatmap(backend, ids, area);
    },
  };
});

const SAX = EXAMPLES.find((e) => e.id === "sax")!;
const OWN_ID = mockId("artist", "The Bamboos");
const request = (ownArtist?: { qlooId: string; name: string }) =>
  planRequestSchema.parse({
    city: "melbourne",
    slot: { date: "2026-10-17", startHour: 17, endHour: 20 },
    performer: { ...SAX.performer, ownArtist },
  });
const withoutOwn = request();
const withOwn = request({ qlooId: OWN_ID, name: "The Bamboos" });

async function busk(req: typeof withOwn) {
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  const { createMockPlanner } = await import("@/server/agent/mock-model");
  const { plan } = await runPlanAgent(new PlanContext(req, OFFLINE, "2026-10-15"), {}, undefined, { model: createMockPlanner() });
  return plan;
}

describe("the sax example carries an own artist (offline demo), its other inputs unchanged", () => {
  it("is The Bamboos' mock id", () => {
    expect(SAX.performer.ownArtist).toEqual({ qlooId: OWN_ID, name: "The Bamboos", spotifyId: expect.stringMatching(/^[A-Za-z0-9]{22}$/) });
    expect(SAX.performer.artists).toEqual(["Stevie Wonder", "Amy Winehouse", "Hiatus Kaiyote", "Kamasi Washington"]);
  });
});

describe("own artist in the taste signal (feature 3)", () => {
  it("sends the own entity first, before the artists you sound like, and adds no plan field without it", async () => {
    cache.clear();
    heatmapIds.length = 0;
    const plain = await busk(withoutOwn);
    expect(plain.ownArtist).toBeUndefined();
    expect(heatmapIds[0]).not.toContain(OWN_ID);
    heatmapIds.length = 0;
    const plan = await busk(withOwn);
    expect(heatmapIds[0][0]).toBe(OWN_ID);
    expect(heatmapIds[0]).toHaveLength(5);
    expect(plan.ownArtist).toMatchObject({ name: "The Bamboos", used: true });
    // The signal changed the taste map: other acts' cached cells are not reused for this one.
    expect(plan.tasteCells).not.toEqual(plain.tasteCells);
  });

  it("says 'from your music' with a share when the own artist drove the crowd's picks", async () => {
    cache.clear();
    const plan = await busk(withOwn);
    expect(plan.crowd.drivers.some((d) => d.name === "The Bamboos")).toBe(true);
    expect(plan.ownArtist!.share).toBeGreaterThan(0);
    expect(plan.ownArtist!.share).toBe(plan.crowd.drivers.find((d) => d.name === "The Bamboos")!.share);
  });

  it("falls back to the artists you sound like, with a note, when Qloo has no taste data for the own entity", async () => {
    cache.clear();
    heatmapIds.length = 0;
    heatmapEmptyFor = OWN_ID;
    try {
      const plan = await busk(withOwn);
      const plain = await busk(withoutOwn);
      expect(plan.ownArtist).toMatchObject({ name: "The Bamboos", used: false, share: null });
      expect(plan.tasteCells).toEqual(plain.tasteCells);
      expect(plan.notes.some((n) => n.includes("no taste data for The Bamboos"))).toBe(true);
      expect(plan.qlooFailed).toBe(false);
      expect(plan.pitches.length).toBeGreaterThan(0);
    } finally {
      heatmapEmptyFor = null;
    }
  });

  it("an unknown own entity changes nothing but gets no 'from your music' and no fans", async () => {
    cache.clear();
    const plan = await busk(request({ qlooId: "4D4F434B-FFFF-FFFF-FFFF-FFFFFFFFFFFF", name: "Nobody" }));
    expect(plan.ownArtist).toMatchObject({ name: "Nobody", share: null, fans: null });
    expect(plan.notes.some((n) => n.includes("no audience data for Nobody"))).toBe(true);
  });
});

describe("who your fans are (feature 4)", () => {
  it("reads the own artist's fans in ONE call per busk and parses them into plan.ownArtist.fans", async () => {
    cache.clear();
    const plain = (await busk(withoutOwn)).researchTotals!.qlooCalls!;
    cache.clear();
    const plan = await busk(withOwn);
    // One extra request (the demographics read) on a cold busk; the heatmap with the own entity replaces the plain one.
    expect(plan.researchTotals!.qlooCalls).toBe(plain + 1);
    const fans = plan.ownArtist!.fans!;
    expect(fans.age.map((a) => a.band)).toContain("25_to_29");
    expect(fans.gender.map((g) => g.band).sort()).toEqual(["female", "male"]);
    // Cached per own artist: the same busk again sends nothing.
    const warm = await busk(withOwn);
    expect(warm.researchTotals!.qlooCalls).toBe(0);
    expect(warm.ownArtist!.fans).toEqual(fans);
  });

  it("old stored plans still parse, and the new field round-trips", async () => {
    cache.clear();
    const plan = await busk(withOwn);
    const old = JSON.parse(JSON.stringify(plan));
    delete old.ownArtist;
    expect(planSchema.parse(old).ownArtist).toBeUndefined();
    expect(planSchema.parse(JSON.parse(JSON.stringify(plan))).ownArtist).toEqual(plan.ownArtist);
  });
});
