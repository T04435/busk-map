import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, type Plan, type PlanRequest } from "@/lib/plan-schema";
import { nextSlotDate } from "@/lib/slot";
import { mockFetch, OFFLINE } from "../../helpers";

const TODAY = "2026-10-15";

async function planFor(id: string): Promise<Plan> {
  vi.resetModules();
  const { buildEnginePlan } = await import("@/server/agent/preload");
  const example = EXAMPLES.find((e) => e.id === id)!;
  const request = planRequestSchema.parse({
    city: "melbourne",
    slot: { date: nextSlotDate(example.weekday, example.startHour, example.endHour, TODAY, 12), startHour: example.startHour, endHour: example.endHour },
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

describe("example requests (offline)", () => {
  it("carry no tip history, and the plans have no tip bonus", async () => {
    mockFetch([]);
    vi.resetModules();
    const { buildEnginePlan, exampleRequests } = await import("@/server/agent/preload");
    for (const request of exampleRequests({ today: TODAY, hour: 12 })) {
      expect(request).not.toHaveProperty("history");
      const plan = await buildEnginePlan(request, OFFLINE, TODAY);
      expect(plan).not.toHaveProperty("tipHistory");
      expect(plan.pitches.every((p) => !("tip" in p))).toBe(true);
    }
  });
});

describe("example presets (inputs only)", () => {
  it("recognises a preset by its performer, whatever the slot", async () => {
    const { exampleRequests, presetIdFor } = await import("@/server/agent/preload");
    const requests = exampleRequests({ today: TODAY, hour: 12 });
    expect(requests.map((r) => presetIdFor(r))).toEqual(["acoustic", "sax", "folk-duo"]);
    const otherSlot: PlanRequest = { ...requests[0], slot: { ...requests[0].slot, startHour: 12, endHour: 14 } };
    expect(presetIdFor(otherSlot)).toBe("acoustic");
    expect(presetIdFor({ ...requests[0], performer: { ...requests[0].performer, name: "Someone else" } })).toBeNull();
  });
});
