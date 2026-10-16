import { describe, expect, it } from "vitest";
import { TIP_BONUS_MAX, TIP_FULL_SESSIONS, tipBonus, type TipHistory } from "@/server/scoring/tips";

const history = (pitches: TipHistory["pitches"], perHour = 30, sessions = 6): TipHistory => ({ source: "yours", sessions, perHour, pitches });

describe("tipBonus", () => {
  it("is null without a usable history", () => {
    expect(tipBonus("a", null)).toBeNull();
    expect(tipBonus("a", undefined)).toBeNull();
    // One session: nothing to compare with.
    expect(tipBonus("a", history([{ id: "a", sessions: 1, perHour: 60 }], 60, 1))).toBeNull();
    // An average of zero can't be compared with.
    expect(tipBonus("a", history([{ id: "a", sessions: 2, perHour: 0 }], 0))).toBeNull();
    // Not logged at this pitch.
    expect(tipBonus("b", history([{ id: "a", sessions: 2, perHour: 60 }]))).toBeNull();
    expect(tipBonus("a", history([{ id: "a", sessions: 0, perHour: 60 }]))).toBeNull();
  });

  it("gives the full bonus at 50% above average after three sessions", () => {
    expect(tipBonus("a", history([{ id: "a", sessions: TIP_FULL_SESSIONS, perHour: 45 }]))).toEqual({
      bonus: TIP_BONUS_MAX,
      sessions: 3,
      perHour: 45,
      averagePerHour: 30,
      lift: 0.5,
    });
    // Capped: doubling the average earns no more than the maximum.
    expect(tipBonus("a", history([{ id: "a", sessions: 5, perHour: 90 }]))!.bonus).toBe(TIP_BONUS_MAX);
  });

  it("scales with the lift and with the number of sessions", () => {
    // 25% above average: half strength; one session of three: a third of the confidence.
    expect(tipBonus("a", history([{ id: "a", sessions: 3, perHour: 37.5 }]))!.bonus).toBe(0.025);
    expect(tipBonus("a", history([{ id: "a", sessions: 1, perHour: 45 }]))!.bonus).toBeCloseTo(TIP_BONUS_MAX / 3, 4);
  });

  it("never penalises a pitch that earned less", () => {
    const below = tipBonus("a", history([{ id: "a", sessions: 3, perHour: 15 }]))!;
    expect(below.bonus).toBe(0);
    expect(below.lift).toBe(-0.5);
  });
});
