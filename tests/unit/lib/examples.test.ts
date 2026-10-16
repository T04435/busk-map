import { describe, expect, it } from "vitest";
import { EXAMPLES, examplePlays, exampleWhen } from "@/lib/examples";

describe("example act cards", () => {
  it("say the day and hours the way the deck does", () => {
    expect(EXAMPLES.map(exampleWhen)).toEqual(["Saturday · 6–9 pm", "Friday · 5–8 pm", "Sunday · 12–3 pm"]);
  });
  it("keep the am/pm on both ends when they differ", () => {
    expect(exampleWhen({ weekday: "sunday", startHour: 10, endHour: 14 })).toBe("Sunday · 10 am–2 pm");
  });
  it("list the first three songs", () => {
    expect(examplePlays(EXAMPLES[0])).toBe("How to Make Gravy, Dumb Things, Depreston");
    expect(examplePlays(EXAMPLES[2], 2)).toBe("Big Jet Plane, Bloom");
  });
});
