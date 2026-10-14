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
    expect(comparePrompt(request)).toMatch(/three spots/);
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
