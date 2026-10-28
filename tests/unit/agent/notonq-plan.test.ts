import { describe, expect, it } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { OFFLINE_TEST_ACTS } from "@/lib/repertoire-research";
import { NOTONQ_FILLED_ID } from "@/server/qloo-mock/notonq";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * A busk for an act Qloo lacks that NotOnQ filled in (lib/notonq.ts), on the offline mocks (the Qloo mock plays the proxy for the
 * NotOnQ test act): the crowd says which stand-ins answered, and the act's own songs in the set are labelled as NotOnQ's artist.
 */
const ACOUSTIC = EXAMPLES.find((e) => e.id === "acoustic")!;
const ACT = OFFLINE_TEST_ACTS.notonq;
const request = (filled: boolean) =>
  planRequestSchema.parse({
    city: "melbourne",
    slot: { date: "2026-10-17", startHour: 17, endHour: 20 },
    performer: {
      ...ACOUSTIC.performer,
      ...(filled
        ? {
            artists: [ACT.name, ...ACOUSTIC.performer.artists.slice(0, 2)],
            songs: [{ title: "A Song Of My Own", artist: ACT.name, own: true }, ...ACOUSTIC.performer.songs],
            ownArtist: { qlooId: NOTONQ_FILLED_ID, name: ACT.name },
          }
        : {}),
    },
  });

async function busk(filled: boolean) {
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  const { createMockPlanner } = await import("@/server/agent/mock-model");
  const { plan } = await runPlanAgent(new PlanContext(request(filled), OFFLINE, "2026-10-15"), {}, undefined, { model: createMockPlanner() });
  return plan;
}

describe("a busk through NotOnQ", () => {
  it("names the stand-ins on the crowd, labels the act's own songs, and leaves Qloo's artists unlabelled", async () => {
    const plan = await busk(true);
    expect(plan.crowd.via).toEqual({ by: "notonq", standIns: [...ACT.standIns] });
    expect(plan.resolvedArtists.find((a) => a.query === ACT.name)?.matched).toBe(ACT.name);
    const set = plan.pitches.flatMap((p) => p.setlist);
    const own = set.filter((s) => s.artist === ACT.name);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((s) => s.filledBy === "notonq")).toBe(true);
    expect(set.filter((s) => s.artist !== ACT.name).every((s) => s.filledBy === undefined)).toBe(true);
    expect(plan.crowd.localArtists.every((a) => a.filledBy === undefined)).toBe(true);
  }, 30_000);

  it("adds nothing NotOnQ to a busk Qloo answered alone", async () => {
    const plan = await busk(false);
    expect(JSON.stringify(plan)).not.toMatch(/notonq|filledBy/i);
  }, 30_000);
});

describe("filledNames", () => {
  it("finds the filled artists in a list, an object's lists and resolved artists, and nothing else", async () => {
    const { filledNames } = await import("@/server/agent/context");
    expect(filledNames(null)).toEqual([]);
    expect(filledNames([{ name: "A", filledBy: "notonq" }, { name: "B" }])).toEqual(["A"]);
    expect(filledNames({ artists: [{ name: "C", filledBy: "notonq" }], impact: [] })).toEqual(["C"]);
    expect(filledNames([{ query: "d", entity: { name: "D", filledBy: "notonq" } }, { query: "e", entity: null }])).toEqual(["D"]);
    expect(filledNames({ a: { b: { c: { d: { name: "Too deep", filledBy: "notonq" } } } } })).toEqual([]);
  });
});
