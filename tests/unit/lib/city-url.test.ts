import { describe, expect, it } from "vitest";
import { parsePlaceParam, placeParam, requestFieldsOf, MELBOURNE_OPTION, optionOf } from "@/lib/city";
import { planRequestSchema } from "@/lib/plan-schema";
import { parsePlanParams, planSearchParams } from "@/lib/plan-url";

const NOW = { today: "2026-10-25", hour: 10 };
const TOKYO = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };
const base = { slot: { date: "2026-10-31", startHour: 18, endHour: 21 }, performer: { name: "Jess", artists: ["Paul Kelly"] } };

describe("the city in a plan URL", () => {
  it("leaves Melbourne links exactly as they were: no city, no place", () => {
    const request = planRequestSchema.parse({ ...requestFieldsOf(MELBOURNE_OPTION), ...base });
    const params = planSearchParams(request);
    expect(params.has("city")).toBe(false);
    expect(params.has("place")).toBe(false);
    const parsed = parsePlanParams(Object.fromEntries(params), NOW);
    expect(parsed.ok && parsed.request).toEqual(request);
  });

  it("round-trips any other city with its place", () => {
    const request = planRequestSchema.parse({ ...requestFieldsOf(TOKYO), ...base });
    const params = planSearchParams(request);
    expect(params.get("city")).toBe("tokyo-jp");
    expect(params.get("place")).toBe("Tokyo~JP~35.6895~139.6917~Asia/Tokyo~Japan");
    const parsed = parsePlanParams(Object.fromEntries(params), NOW);
    expect(parsed.ok && parsed.request).toEqual(request);
    expect(optionOf(request)).toMatchObject({ id: "tokyo-jp", name: "Tokyo", timeZone: "Asia/Tokyo" });
  });

  it("refuses a non-Melbourne city whose place is missing or unreadable", () => {
    expect(parsePlanParams({ name: "Jess", artists: "Paul Kelly", date: "2026-10-31", city: "tokyo-jp" }, NOW).ok).toBe(false);
    expect(parsePlanParams({ name: "Jess", artists: "Paul Kelly", date: "2026-10-31", city: "tokyo-jp", place: "Tokyo~JP~x~y~Asia/Tokyo~Japan" }, NOW).ok).toBe(false);
    expect(parsePlaceParam("Tokyo~JP~35.6895~139.6917~Nowhere/Zone~Japan")).toBeUndefined();
    expect(parsePlaceParam(placeParam({ ...TOKYO, name: "To~kyo" }))).toMatchObject({ name: "To kyo" });
  });
});
