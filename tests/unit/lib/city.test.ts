import { describe, expect, it } from "vitest";
import {
  boxAround,
  cityFromPlace,
  cityLabel,
  cityLevels,
  cityOfRequest,
  citySlug,
  isMelbournePlace,
  isTimeZone,
  MELBOURNE,
  placeOf,
  requestCityFields,
} from "@/lib/city";
import { inBBox } from "@/lib/geo";
import { planRequestSchema } from "@/lib/plan-schema";

const TOKYO_PLACE = { name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo" };
const performer = { name: "Jess", artists: ["Paul Kelly"] };
const slot = { date: "2026-10-31", startHour: 18, endHour: 21 };

describe("city slugs", () => {
  it("names a city by name, region and country, and keeps Melbourne, Victoria as the built-in slug", () => {
    expect(citySlug(TOKYO_PLACE, "Tokyo")).toBe("tokyo-jp");
    expect(citySlug({ name: "Melbourne", countryCode: "US", lat: 28.0836, lon: -80.6081 }, "Florida")).toBe("melbourne-florida-us");
    expect(citySlug({ name: "Melbourne", countryCode: "AU", lat: -37.814, lon: 144.9633 }, "Victoria")).toBe("melbourne");
    expect(citySlug({ name: "São Paulo", countryCode: "BR", lat: -23.5475, lon: -46.6361 }, "São Paulo")).toBe("sao-paulo-br");
  });

  it("falls back to the rounded point for a name with no Latin letters", () => {
    expect(citySlug({ name: "東京", countryCode: "JP", lat: 35.6895, lon: 139.6917 })).toBe("at-3569n-13969e-jp");
  });

  it("tells the built-in Melbourne from its namesakes", () => {
    expect(isMelbournePlace({ countryCode: "AU", lat: -37.81, lon: 144.96 })).toBe(true);
    expect(isMelbournePlace({ countryCode: "US", lat: 28.08, lon: -80.6 })).toBe(false);
    expect(isMelbournePlace({ countryCode: "AU", lat: -33.87, lon: 151.21 })).toBe(false);
  });
});

describe("City from a geocoded place", () => {
  it("plans in a box about Melbourne's size around the point, in the place's time zone", () => {
    const tokyo = cityFromPlace("tokyo-jp", TOKYO_PLACE);
    expect(tokyo).toMatchObject({ id: "tokyo-jp", name: "Tokyo", countryCode: "JP", timeZone: "Asia/Tokyo", source: "open-meteo", center: { lat: 35.6895, lon: 139.6917 } });
    expect(inBBox(tokyo.center, tokyo.bbox)).toBe(true);
    expect(tokyo.bbox.north - tokyo.bbox.south).toBeCloseTo(3.2 / 111.32, 3);
    expect(placeOf(tokyo)).toEqual(TOKYO_PLACE);
  });

  it("keeps the box sane near the poles", () => {
    const box = boxAround({ lat: 89.9, lon: 0 });
    expect(Number.isFinite(box.east) && box.east - box.west < 10).toBe(true);
  });

  it("knows real time zones only", () => {
    expect(isTimeZone("Asia/Tokyo")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
  });

  it("labels namesakes apart", () => {
    expect(cityLabel({ name: "Tokyo", region: "Tokyo", country: "Japan" })).toBe("Tokyo, Japan");
    expect(cityLabel({ name: "Melbourne", region: "Florida", country: "United States" })).toBe("Melbourne, Florida, United States");
  });
});

describe("the request's city", () => {
  it("is Melbourne when it says so or says nothing, with no extra key", () => {
    const named = planRequestSchema.parse({ city: "melbourne", slot, performer });
    const silent = planRequestSchema.parse({ slot, performer });
    expect(named).toEqual(silent);
    expect(named.city).toBe("melbourne");
    expect("place" in named).toBe(false);
    expect(cityOfRequest(named)).toBe(MELBOURNE);
    expect(requestCityFields(MELBOURNE)).toEqual({ city: "melbourne" });
  });

  it("carries any other city's place, and refuses a city without one (or Melbourne with one)", () => {
    const tokyo = cityFromPlace("tokyo-jp", TOKYO_PLACE);
    const parsed = planRequestSchema.parse({ ...requestCityFields(tokyo), slot, performer });
    expect(cityOfRequest(parsed)).toEqual(tokyo);
    expect(planRequestSchema.safeParse({ city: "tokyo-jp", slot, performer }).success).toBe(false);
    expect(planRequestSchema.safeParse({ city: "melbourne", place: TOKYO_PLACE, slot, performer }).success).toBe(false);
    expect(planRequestSchema.safeParse({ city: "Tokyo JP", place: TOKYO_PLACE, slot, performer }).success).toBe(false);
    expect(planRequestSchema.safeParse({ city: "tokyo-jp", place: { ...TOKYO_PLACE, timeZone: "Nowhere/Zone" }, slot, performer }).success).toBe(false);
  });
});

describe("city levels", () => {
  it("gives Melbourne its own rules, spots and hotspots, and every city the worldwide signals", () => {
    expect(cityLevels(MELBOURNE)).toEqual({ taste: "global", activity: "global", events: "global", weather: "global", rules: "local", pitches: "local", hotspots: "local" });
    expect(cityLevels({ id: "tokyo-jp" })).toMatchObject({ taste: "global", rules: "none", pitches: "none", hotspots: "none" });
  });
});
