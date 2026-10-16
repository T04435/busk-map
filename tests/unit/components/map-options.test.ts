import { describe, expect, it } from "vitest";
import { MAP_GESTURES, ORANGE_FROM, TASTE_STEP_FROM, orangeCells } from "@/components/map/taste-cells";

describe("map options", () => {
  it("turns on cooperative gestures so the page keeps one-finger and wheel scroll (B-227)", () => {
    expect(MAP_GESTURES.cooperativeGestures).toBe(true);
  });

  it("draws orange taste steps 3 to 5 only", () => {
    expect(ORANGE_FROM).toBeLessThan(TASTE_STEP_FROM[4]);
    expect(TASTE_STEP_FROM[4]).toBeLessThan(TASTE_STEP_FROM[5]);
    expect(orangeCells([{ affinity: 0.1 }, { affinity: 0.47 }, { affinity: 0.48 }, { affinity: 0.95 }])).toHaveLength(2);
  });
});
