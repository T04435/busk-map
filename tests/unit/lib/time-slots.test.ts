import { describe, expect, it } from "vitest";
import { fillCount } from "@/components/landing/performer-form";
import { splitTypedQuery } from "@/components/landing/song-search";
import { choiceForHours, hoursLabel, hoursOf, NAMED_SLOTS } from "@/lib/time-slots";

describe("named time slots", () => {
  it("map to fixed hours: Morning 9-12, Lunch 12-3, Afternoon 3-6, Evening 6-9", () => {
    expect(NAMED_SLOTS.map((s) => [s.label, s.startHour, s.endHour])).toEqual([
      ["Morning", 9, 12],
      ["Lunch", 12, 15],
      ["Afternoon", 15, 18],
      ["Evening", 18, 21],
    ]);
    expect(hoursLabel(12, 15)).toBe("12 pm–3 pm");
  });

  it("old from/to hours press the matching named slot, otherwise stay as a custom choice", () => {
    expect(choiceForHours(18, 21)).toEqual({ kind: "named", id: "evening" });
    expect(choiceForHours(12, 15)).toEqual({ kind: "named", id: "lunch" });
    expect(choiceForHours(10, 13)).toEqual({ kind: "custom", startHour: 10, endHour: 13 });
    expect(choiceForHours(17, 20)).toEqual({ kind: "custom", startHour: 17, endHour: 20 });
  });

  it("a choice sends its hours, and Any time sends none", () => {
    expect(hoursOf({ kind: "any" })).toBeNull();
    expect(hoursOf({ kind: "named", id: "morning" })).toEqual({ startHour: 9, endHour: 12 });
    expect(hoursOf({ kind: "custom", startHour: 10, endHour: 13 })).toEqual({ startHour: 10, endHour: 13 });
  });
});

describe("the suggested-fill count the form sends (plan-inputs D4)", () => {
  it("sends none while nothing is removed, at least 3 when something is, at most 8", () => {
    expect(fillCount(0, 5)).toBeUndefined();
    expect(fillCount(1, 4)).toBe(3);
    expect(fillCount(3, 2)).toBe(3);
    expect(fillCount(5, 2)).toBe(5);
    expect(fillCount(20, 2)).toBe(8);
  });
  it("sends 6 after Remove all or with no songs at all", () => {
    expect(fillCount(9, 0)).toBe(6);
    expect(fillCount(0, 0)).toBe(6);
  });
});

describe("the type-it-in fallback prefill", () => {
  it("splits the query on ' - ' into title and artist", () => {
    expect(splitTypedQuery("Laneway Light - The Larkspur Two")).toEqual({ title: "Laneway Light", artist: "The Larkspur Two" });
    expect(splitTypedQuery("Laneway Light")).toEqual({ title: "Laneway Light", artist: "" });
    expect(splitTypedQuery("  A – B - C ")).toEqual({ title: "A", artist: "B - C" });
  });
});
