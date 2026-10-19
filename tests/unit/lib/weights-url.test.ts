import { describe, expect, it } from "vitest";
import { parseWeightsParam, weightsParam } from "@/lib/weights-url";
import { normalizeWeights } from "@/server/scoring";

describe("weights in a link", () => {
  it("writes and reads the current shape: wa=taste,activity,events,weather[,discovery]", () => {
    expect(weightsParam({ taste: 0.5, activity: 0.3, events: 0.1, weather: 0.2, discovery: 0.05 })).toEqual(["wa", "0.5,0.3,0.1,0.2,0.05"]);
    expect(weightsParam({ taste: 0.5, activity: 0.3, events: 0.1, weather: 0.2 })).toEqual(["wa", "0.5,0.3,0.1,0.2"]);
    expect(parseWeightsParam("0.5,0.3,0.1,0.2,0.05")).toEqual({ taste: 0.5, activity: 0.3, events: 0.1, weather: 0.2, discovery: 0.05 });
    expect(parseWeightsParam("0.5,0.3,0.1,0.2")).toEqual({ taste: 0.5, activity: 0.3, events: 0.1, weather: 0.2 });
  });

  it("still reads an older link (w=taste,footfall,places,events,weather[,discovery]) and writes it back unchanged", () => {
    const old = parseWeightsParam(undefined, "0.5,0.2,0.1,0.1,0.3");
    expect(old).toEqual({ taste: 0.5, footfall: 0.2, places: 0.1, events: 0.1, weather: 0.3 });
    expect(weightsParam(old)).toEqual(["w", "0.5,0.2,0.1,0.1,0.3"]);
    expect(parseWeightsParam(undefined, "1,0,0,0,0.5,0.08")).toEqual({ taste: 1, footfall: 0, places: 0, events: 0, weather: 0.5, discovery: 0.08 });
    // Footfall and places count together as the activity weight.
    expect(normalizeWeights(old).activity).toBeCloseTo(0.3);
  });

  it("ignores malformed values and prefers the current shape", () => {
    expect(parseWeightsParam("1,2")).toBeUndefined();
    expect(parseWeightsParam("a,b,c,d")).toBeUndefined();
    expect(parseWeightsParam(undefined, "1,2,3")).toBeUndefined();
    expect(parseWeightsParam("0.4,0.4,0.1,0.1", "1,0,0,0,0")).toMatchObject({ activity: 0.4 });
    expect(weightsParam(undefined)).toBeNull();
    expect(weightsParam({ taste: 1 })).toBeNull();
  });
});
