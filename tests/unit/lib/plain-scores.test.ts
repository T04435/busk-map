import { describe, expect, it } from "vitest";
import { plainScores, strengthWord } from "@/lib/plain-scores";

describe("plainScores (no raw scores in what people read)", () => {
  it("the live sheet sentence", () => {
    expect(plainScores("The engine scored it highest at 64/100, with taste 0.81 and activity 0.7 (estimated). It has 2 cautions listed.")).toBe(
      "The engine scored it highest, with taste (strong) and activity (busy) (estimated). It has 2 cautions listed.",
    );
  });
  it("the live Hive summary sentence", () => {
    expect(plainScores("City Square (61/100, taste 0.9) scored higher than two of the picks, but it is the same corner as Centre Place (within 250 m).")).toBe(
      "City Square (taste (very strong)) scored higher than two of the picks, but it is the same corner as Centre Place (within 250 m).",
    );
  });
  it("a bare decimal in brackets and out-of-100 phrasing", () => {
    expect(plainScores("The weather penalty (0.46) comes from 70% rain at 6 pm.")).toBe("The weather penalty comes from 70% rain at 6 pm.");
    expect(plainScores("Qloo taste match 64 out of 100 here.")).toBe("Qloo taste match here.");
    expect(plainScores("Score 52/100: a usual pitch.")).toBe("Score: a usual pitch.");
  });
  it("keeps times, distances, rain chances, years and counts", () => {
    const t = "Crowd leaves around 6:30 pm, 250 m away, 63% rain, from 2016, 46 pitches scored, 3 of 25 picks, 16.1°C.";
    expect(plainScores(t)).toBe(t);
  });
  it("is idempotent", () => {
    const once = plainScores("scored 64/100 with taste 0.81");
    expect(plainScores(once)).toBe(once);
  });
});

describe("strengthWord", () => {
  it("bands", () => {
    expect([0.95, 0.75, 0.55, 0.35, 0.1].map(strengthWord)).toEqual(["Very strong", "Strong", "Good", "Some", "Weak"]);
  });
});
