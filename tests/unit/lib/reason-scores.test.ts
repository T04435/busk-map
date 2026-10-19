import { describe, expect, it } from "vitest";
import { splitReasonScores } from "@/lib/reason-scores";

describe("splitReasonScores (scores stay out of prose)", () => {
  it("pulls the affinity and local-scene scores out of a set reason", () => {
    expect(splitReasonScores("Crowd affinity for Paul Kelly: 100/100; local scene act your fans would like (63/100); 1.2M Last.fm plays; from 2016")).toEqual({
      text: "Crowd affinity for Paul Kelly; local scene act your fans would like; 1.2M Last.fm plays; from 2016",
      scores: [
        { label: "Affinity", value: 100 },
        { label: "Local scene", value: 63 },
      ],
    });
  });

  it("leaves a reason without scores as it is", () => {
    expect(splitReasonScores("Your own song: scored with your typical crowd affinity")).toEqual({ text: "Your own song: scored with your typical crowd affinity", scores: [] });
  });
});
