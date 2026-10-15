import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, type Plan } from "@/lib/plan-schema";
import { nextWeekday } from "@/lib/slot";
import { mockFetch, OFFLINE } from "../../helpers";

const TODAY = "2026-10-15";

async function planFor(id: string): Promise<Plan> {
  vi.resetModules();
  const { buildEnginePlan } = await import("@/server/agent/preload");
  const example = EXAMPLES.find((e) => e.id === id)!;
  const request = planRequestSchema.parse({
    city: "melbourne",
    slot: { date: nextWeekday(example.weekday, TODAY), startHour: example.startHour, endHour: example.endHour },
    performer: example.performer,
  });
  return buildEnginePlan(request, OFFLINE, TODAY);
}

describe("example performers get data-led, different plans (offline)", () => {
  it("gives each example a different top three, map and crowd, with a hidden gem in each", async () => {
    mockFetch([]);
    const plans = Object.fromEntries(await Promise.all(EXAMPLES.map(async (e) => [e.id, await planFor(e.id)] as const)));
    for (const [id, plan] of Object.entries(plans)) {
      console.log(id, plan.pitches.map((p) => `${p.name} ${p.score} ${p.discovery ?? "-"} cell${p.cellRank ?? "-"} ${p.footfallSource}`).join(" | "), JSON.stringify(plan.funnel));
    }
    const tops = EXAMPLES.map((e) => plans[e.id].pitches.map((p) => p.id));
    for (const top of tops) expect(top).toHaveLength(3);
    // Different top three for every pair, and a different first pitch.
    for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
      expect(tops[i]).not.toEqual(tops[j]);
      expect(tops[i][0]).not.toBe(tops[j][0]);
    }
    // Different taste maps: the strongest cell differs.
    const best = (plan: Plan) => [...plan.tasteCells].sort((a, b) => b.affinity - a.affinity)[0].geohash;
    expect(new Set(EXAMPLES.map((e) => best(plans[e.id]))).size).toBe(3);
    for (const e of EXAMPLES) {
      const plan = plans[e.id];
      expect(plan.pitches.some((p) => p.discovery === "hidden-gem")).toBe(true);
      expect(plan.pitches.every((p) => p.origin !== "fallback")).toBe(true);
      expect(plan.funnel?.topCells).toBeGreaterThan(0);
      expect(plan.crowd.localArtists.length).toBeGreaterThan(0);
      expect(plan.crowd.drivers.length).toBeGreaterThan(0);
    }
  });
});

describe("example tip logs (offline)", () => {
  it("add a small, explained bonus where the example performer earned more, keeping the same top three", async () => {
    mockFetch([]);
    vi.resetModules();
    const { buildEnginePlan, exampleRequests } = await import("@/server/agent/preload");
    for (const [i, request] of exampleRequests(TODAY).entries()) {
      expect(request.history?.source).toBe("example");
      const withTips = await buildEnginePlan(request, OFFLINE, TODAY);
      const without = await buildEnginePlan({ ...request, history: undefined }, OFFLINE, TODAY);
      expect(withTips.tipHistory).toMatchObject({ source: "example" });
      expect(without.tipHistory).toBeNull();
      // Each example log has two strong pitches (one near the top of the live plan, one of the mock's), so a top-three pitch gets a bonus.
      const boosted = withTips.pitches.filter((p) => p.tip && p.tip.points > 0);
      expect(boosted.length, EXAMPLES[i].id).toBeGreaterThan(0);
      for (const pitch of boosted) {
        expect(pitch.tip!.points).toBeGreaterThanOrEqual(2);
        expect(pitch.tip!.points).toBeLessThanOrEqual(5);
        const before = without.pitches.find((p) => p.id === pitch.id);
        expect(before, `${EXAMPLES[i].id}: ${withTips.pitches.map((p) => `${p.id} ${p.score}`).join(", ")} vs ${without.pitches.map((p) => `${p.id} ${p.score}`).join(", ")}`).toBeDefined();
        expect(pitch.score).toBe(before!.score + pitch.tip!.points);
      }
      // Personal results only nudge: the example plans keep the same top three (a near tie may swap places).
      expect(withTips.pitches.map((p) => p.id).sort()).toEqual(without.pitches.map((p) => p.id).sort());
      // Pitches where they earned less get no bonus.
      const strong = new Set(["spot:osm:albert-coates-lane", "spot:osm:city-square", "spot:osm:centre-place", "spot:osm:cohen-place-plaza", "spot:osm:federation-wharf"]);
      expect(withTips.pitches.filter((p) => !strong.has(p.id)).every((p) => !p.tip || p.tip.points === 0)).toBe(true);
    }
  });
});
