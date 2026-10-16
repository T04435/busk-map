import { describe, expect, it } from "vitest";
import { planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequestInput } from "@/lib/plan-schema";
import { parsePlanParams, planSearchParams } from "@/lib/plan-url";
import { describeSlot, isAnyTime, requestSlotSchema } from "@/lib/slot";
import { parseWeekParams, weekSearchParams } from "@/lib/week-url";
import { weekRequestSchema } from "@/lib/week-schema";

const now = { today: "2026-10-15", hour: 12 };
const performer = { name: "Jess", artists: ["Paul Kelly"], spotifyArtists: [], songs: [{ title: "Dumb Things", artist: "Paul Kelly", own: false }] };
const base: PlanRequestInput = { city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer };

describe("request slot union (D1)", () => {
  it("parses fixed hours and any time", () => {
    expect(requestSlotSchema.parse({ date: "2026-10-17", startHour: 18, endHour: 21 })).toEqual({ date: "2026-10-17", startHour: 18, endHour: 21 });
    const any = requestSlotSchema.parse({ date: "2026-10-17", any: true });
    expect(any).toEqual({ date: "2026-10-17", any: true });
    expect(isAnyTime(any)).toBe(true);
  });
  it("hours given are hours meant: the fixed shape wins and `any` is stripped", () => {
    const slot = requestSlotSchema.parse({ date: "2026-10-17", startHour: 12, endHour: 15, any: true });
    expect(slot).toEqual({ date: "2026-10-17", startHour: 12, endHour: 15 });
    expect(isAnyTime(slot)).toBe(false);
  });
  it("keeps the fixed refinements and rejects `any: false` and a bare date", () => {
    expect(requestSlotSchema.safeParse({ date: "2026-10-17", startHour: 18, endHour: 17 }).success).toBe(false);
    expect(requestSlotSchema.safeParse({ date: "2026-10-17", any: false }).success).toBe(false);
    expect(requestSlotSchema.safeParse({ date: "2026-10-17" }).success).toBe(false);
  });
  it("helpers: describe", () => {
    expect(describeSlot({ date: "2026-10-17", any: true })).toBe("Saturday 2026-10-17, any time, Busk Map picks the hours");
  });
});

describe("performer.fillSuggested and skipSongs (D4, D6)", () => {
  const parse = (extra: Record<string, unknown>) => planRequestSchema.safeParse({ ...base, performer: { ...performer, ...extra } });
  it("are optional and never defaulted", () => {
    const r = planRequestSchema.parse(base);
    expect("fillSuggested" in r.performer).toBe(false);
    expect("skipSongs" in r.performer).toBe(false);
  });
  it("accepts 1 to 8 and nothing else", () => {
    expect(parse({ fillSuggested: 1 }).success).toBe(true);
    expect(parse({ fillSuggested: 8 }).success).toBe(true);
    for (const bad of [0, 9, 2.5, "3"]) expect(parse({ fillSuggested: bad }).success).toBe(false);
  });
  it("an empty song list is valid with the fill flag; artists still need one", () => {
    expect(parse({ songs: [], fillSuggested: 6 }).success).toBe(true);
    expect(parse({ artists: [] }).success).toBe(false);
  });
  it("skipSongs holds up to 60 title/artist pairs", () => {
    const song = { title: "A", artist: "B" };
    expect(parse({ fillSuggested: 3, skipSongs: Array(60).fill(song) }).success).toBe(true);
    expect(parse({ fillSuggested: 3, skipSongs: Array(61).fill(song) }).success).toBe(false);
    expect(parse({ fillSuggested: 3, skipSongs: [{ title: "", artist: "B" }] }).success).toBe(false);
  });
});

describe("plan URL: time=any, fill and skip", () => {
  const act = { name: "Jess", artists: "Paul Kelly", date: "2026-10-17" };
  it("old links are unchanged: from/to, no fill", () => {
    const p = parsePlanParams({ ...act, from: "17", to: "20" }, now);
    expect(p.ok && p.request.slot).toEqual({ date: "2026-10-17", startHour: 17, endHour: 20 });
    expect(p.ok && "fillSuggested" in p.request.performer).toBe(false);
  });
  it("time=any ignores from and to", () => {
    const p = parsePlanParams({ ...act, time: "any", from: "17", to: "20" }, now);
    expect(p.ok && p.request.slot).toEqual({ date: "2026-10-17", any: true });
  });
  it("examples keep their fixed slots (D8) and ignore time, fill and skip", () => {
    const p = parsePlanParams({ example: "sax", time: "any", fill: "4", skip: "A~B" }, { today: "2026-10-14", hour: 12 });
    expect(p.ok && isAnyTime(p.request.slot)).toBe(false);
    expect(p.ok && "fillSuggested" in p.request.performer).toBe(false);
  });
  it("round-trips any time, fill and skip", () => {
    const parsed = parsePlanParams({ ...act, time: "any", fill: "6", skip: "Dumb Things~Paul Kelly|Stray~Jess", songs: "Hello~Adele" }, now);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.performer.fillSuggested).toBe(6);
    expect(parsed.request.performer.skipSongs).toEqual([{ title: "Dumb Things", artist: "Paul Kelly" }, { title: "Stray", artist: "Jess" }]);
    const qs = planSearchParams(parsed.request);
    expect(qs.get("time")).toBe("any");
    expect(qs.has("from")).toBe(false);
    expect(qs.has("to")).toBe(false);
    const again = parsePlanParams(Object.fromEntries(qs), now);
    expect(again.ok && again.request).toEqual(parsed.request);
  });
  it("writes from/to and no fill params for an old-style request", () => {
    const qs = planSearchParams(planRequestSchema.parse(base));
    expect(qs.get("from")).toBe("18");
    expect(qs.get("to")).toBe("21");
    expect(qs.has("time") || qs.has("fill") || qs.has("skip")).toBe(false);
  });
  it("ignores a bad fill count and writes skip only with fill", () => {
    for (const fill of ["0", "9", "x", ""]) {
      const p = parsePlanParams({ ...act, fill, skip: "A~B" }, now);
      expect(p.ok && "fillSuggested" in p.request.performer).toBe(false);
      expect(p.ok && "skipSongs" in p.request.performer).toBe(false);
    }
  });
  it("an empty song list with fill round-trips", () => {
    const parsed = parsePlanParams({ ...act, fill: "6" }, now);
    expect(parsed.ok && parsed.request.performer.songs).toEqual([]);
    expect(parsed.ok && planSearchParams(parsed.request).get("fill")).toBe("6");
  });
});

describe("week URL: fill and skip ride in the performer; no time=any (D9)", () => {
  it("round-trips fill and skip", () => {
    const parsed = parseWeekParams({ name: "Jess", artists: "Paul Kelly", fill: "5", skip: "A~B" }, "2026-10-15");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.performer.fillSuggested).toBe(5);
    const qs = weekSearchParams(parsed.request, null);
    expect(qs.get("fill")).toBe("5");
    expect(qs.get("skip")).toBe("A~B");
    expect(qs.has("time")).toBe(false);
    const again = parseWeekParams(Object.fromEntries(qs), "2026-10-15");
    expect(again.ok && again.request).toEqual(parsed.request);
  });
  it("an old week link has no fill keys", () => {
    const parsed = parseWeekParams({ name: "Jess", artists: "Paul Kelly" }, "2026-10-15");
    expect(parsed.ok && "fillSuggested" in parsed.request.performer).toBe(false);
    expect(weekRequestSchema.safeParse(parsed.ok && parsed.request).success).toBe(true);
  });
});

describe("form errors for the new fields", () => {
  const errorFor = (input: PlanRequestInput) => {
    const result = planRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
    return planFormError(result.error!.issues, input);
  };
  it("names the fill count, skipped songs and an invalid slot", () => {
    expect(errorFor({ ...base, performer: { ...performer, fillSuggested: 9 } })).toMatch(/^Suggested songs: /);
    expect(errorFor({ ...base, performer: { ...performer, fillSuggested: 3, skipSongs: [{ title: "", artist: "B" }] } })).toMatch(/^Songs left out: /);
    expect(errorFor({ ...base, slot: { date: "not-a-date", any: true } })).toBe("Date: Pick today or a later date.");
    expect(errorFor({ ...base, slot: { date: "2026-10-17", startHour: 18, endHour: 17 } })).toMatch(/^Check the date and times/);
  });
});

describe("issuePaths", () => {
  it("expands the slot union to the field inside it", async () => {
    const { issuePaths } = await import("@/lib/form-errors");
    const r = planRequestSchema.safeParse({ city: "melbourne", slot: { date: "nope" } });
    expect(r.success).toBe(false);
    expect(issuePaths(r.error!.issues)).toContain("slot.date");
  });
});
