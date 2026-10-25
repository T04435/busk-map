import { describe, expect, it } from "vitest";
import { fansCityParam, fansCityQuery, nearestCityOption, parseFansCityParam, parsePlaceParam, placeParam, requestFieldsOf, MELBOURNE_OPTION, optionOf } from "@/lib/city";
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

describe("the fans city in a /busks link", () => {
  const BOGOTA = { name: "Bogota", lat: 4.711, lng: -74.0721 };
  const opt = (id: string, name: string, lat: number, lon: number) => ({ id, name, country: "X", countryCode: "XX", lat, lon, timeZone: "UTC", region: null });

  it("round-trips the name and the marker's point", () => {
    expect(fansCityParam(BOGOTA)).toBe("Bogota~4.711~-74.0721");
    expect(parseFansCityParam(fansCityParam(BOGOTA))).toEqual({ name: "Bogota", lat: 4.711, lon: -74.0721 });
    expect(parseFansCityParam(fansCityParam({ name: "A~B", lat: 1, lng: 2 }))?.name).toBe("A B");
  });

  it("refuses a missing or unreadable param", () => {
    for (const bad of [undefined, "", "Bogota", "Bogota~x~y", "Bogota~95~0", "~1~2", "Bogota~1"]) expect(parseFansCityParam(bad)).toBeUndefined();
  });

  it("searches the name before a comma", () => {
    expect(fansCityQuery("Havana, Cuba")).toBe("Havana");
    expect(fansCityQuery("Bogota")).toBe("Bogota");
  });

  it("picks the geocoded city nearest the marker, within 100 km", () => {
    const bogotaCo = opt("bogota-bogota-dc-co", "Bogota", 4.6097, -74.0817);
    const bogotaNj = opt("bogota-new-jersey-us", "Bogota", 40.8765, -74.0277);
    expect(nearestCityOption([bogotaNj, bogotaCo], { lat: BOGOTA.lat, lon: BOGOTA.lng })).toBe(bogotaCo);
    expect(nearestCityOption([bogotaNj], { lat: BOGOTA.lat, lon: BOGOTA.lng })).toBeNull();
    expect(nearestCityOption([], { lat: 0, lon: 0 })).toBeNull();
  });

  it("resolves Melbourne, Victoria to the built-in Melbourne", () => {
    const fromGeocoder = opt("melbourne", "Melbourne", -37.814, 144.9633);
    expect(nearestCityOption([fromGeocoder], { lat: -37.8136, lon: 144.9631 })).toBe(MELBOURNE_OPTION);
  });
});
