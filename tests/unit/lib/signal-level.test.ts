import { describe, expect, it } from "vitest";
import { cityLevels, MELBOURNE } from "@/lib/city";
import { levelsToLabel, levelWord, liveSource, rulesChecked, RULES_NOT_CHECKED } from "@/lib/signal-level";
import { slotEyebrow } from "@/lib/slot";

/** V2 2.2 and 2.4: each signal's level in plain words, and the rules line outside Melbourne. */
describe("signal levels", () => {
  const tokyo = levelsToLabel("tokyo-jp");

  it("labels nothing in Melbourne: its plans keep today's labels", () => {
    expect(levelsToLabel("melbourne", cityLevels(MELBOURNE))).toBeNull();
    expect(levelWord("activity", null)).toBeNull();
    expect(levelWord("rules", levelsToLabel("melbourne"))).toBeNull();
    expect(rulesChecked(null)).toBe(true);
  });

  it("names each signal's level in another city", () => {
    expect(tokyo).toEqual(cityLevels({ id: "tokyo-jp" }));
    expect(levelWord("rules", tokyo)).toBe("Not checked");
    expect(levelWord("hotspots", tokyo)).toBe("Not checked");
    expect(levelWord("activity", tokyo)).toBe("Estimate");
    expect(levelWord("activity", tokyo, false)).toBe("Estimate");
    expect(levelWord("taste", tokyo)).toBe("Live data");
    expect(levelWord("events", tokyo)).toBe("Live data");
    expect(levelWord("weather", tokyo)).toBe("Live data");
    expect(rulesChecked(tokyo)).toBe(false);
  });

  it("never says Live data for a source that answered with test data or not at all", () => {
    expect(levelWord("weather", tokyo, false)).toBeNull();
    const status = [
      { source: "qloo", mode: "synthetic" },
      { source: "open-meteo", mode: "live" },
      { source: "ticketmaster", mode: "fallback" },
    ];
    expect(liveSource("weather", status)).toBe(true);
    expect(liveSource("taste", status)).toBe(false);
    expect(liveSource("events", status)).toBe(false);
  });

  it("keeps stored levels over the city's defaults", () => {
    const stored = { ...cityLevels({ id: "tokyo-jp" }), pitches: "global" as const };
    expect(levelsToLabel("tokyo-jp", stored)).toBe(stored);
  });

  it("words the rules line and drops the permit from the eyebrow", () => {
    expect(RULES_NOT_CHECKED).toBe("Local busking rules not checked: check with the city before you play.");
    const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };
    expect(slotEyebrow(slot, "general")).toMatch(/ · General permit$/);
    expect(slotEyebrow(slot, null)).not.toMatch(/permit/i);
  });
});
