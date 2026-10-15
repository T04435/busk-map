import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";

async function load() {
  vi.resetModules();
  return import("@/server/agent/compare");
}

describe("plain-LLM comparison", () => {
  it("recognises Melbourne's usual busking spots in free text", async () => {
    const { usualSpotMentioned } = await load();
    expect(usualSpotMentioned("Bourke St Mall at lunch")).toBe("Bourke Street Mall");
    expect(usualSpotMentioned("outside Fed Square")).toBe("Federation Square");
    expect(usualSpotMentioned("the steps of Flinders Street Station")).toBe("Flinders Street Station");
    expect(usualSpotMentioned("Queen Vic Market on Sunday")).toBe("Queen Victoria Market");
    expect(usualSpotMentioned("Lincoln Square")).toBeNull();
  });

  it("returns three structured spots, flagged against the hotspots (offline mock model)", async () => {
    const { plainLlmSuggestion, comparePrompt } = await load();
    const request = { city: "melbourne" as const, slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer };
    expect(comparePrompt(request)).toMatch(/three best spots/);
    const result = await plainLlmSuggestion(request, true);
    expect(result.text).toBeTruthy();
    if (result.text === null) return;
    expect(result.spots).toHaveLength(3);
    expect(result.spots.every((s) => s.usualSpot !== null)).toBe(true);
    expect(result.setlist).toContain("Wonderwall");
  });

  it("is unavailable without a gateway", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    const { plainLlmSuggestion } = await load();
    const result = await plainLlmSuggestion({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer }, false);
    expect(result).toEqual({ text: null, reason: "unavailable" });
  });
});

describe("plain-AI baseline against the plan", () => {
  it("runs offline, sorts the picks into buckets, records ids and scores only, and leaves the plan's scores alone", async () => {
    vi.resetModules();
    const { planRequestSchema } = await import("@/lib/plan-schema");
    const { baselineFor } = await import("@/server/agent/baseline");
    const { buildEnginePlan, exampleRequests } = await import("@/server/agent/preload");
    const { comparisonStore } = await import("@/server/comparisons/store");
    const OFFLINE = { offline: true, faults: [] };
    const day = "2026-10-15";
    const request = exampleRequests(day)[0];
    const before = await buildEnginePlan(planRequestSchema.parse(request), OFFLINE, day);
    const scores = before.pitches.map((p) => [p.id, p.score]);

    const result = await baselineFor(request, OFFLINE, day);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const { baseline } = result;
    expect(baseline.plain).toHaveLength(3);
    // The mock answers with the famous spots: Bourke Street Mall by name, Federation Square with no coordinates, Flinders Street by name.
    expect(baseline.plain.every((p) => p.status !== "no-data")).toBe(true);
    expect(baseline.plain[0]).toMatchObject({ locatedBy: "name", place: "Bourke Street Mall", usualSpot: "Bourke Street Mall" });
    expect(baseline.bothAgree.length + baseline.onlyBuskMap.length).toBe(before.pitches.length);
    // Same promise for the same plan.
    expect(await baselineFor(request, OFFLINE, day)).toBe(result);

    const after = await buildEnginePlan(planRequestSchema.parse(request), OFFLINE, day);
    expect(after.pitches.map((p) => [p.id, p.score])).toEqual(scores);

    await new Promise((r) => setTimeout(r, 0));
    const store = comparisonStore(true) as unknown as { records: { performerKey: string }[] };
    expect(store.records.at(-1)).toMatchObject({ performerKey: "acoustic", city: "melbourne" });
    expect(JSON.stringify(store.records)).not.toMatch(/Acoustic singer|Bourke/);
  });
});
