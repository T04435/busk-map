import { describe, expect, it } from "vitest";
import {
  boxAround,
  cityFromPlace,
  cityLabel,
  cityLevels,
  cityOfRequest,
  citySlug,
  DEFAULT_RADIUS_KM,
  isMelbournePlace,
  isMetro,
  isTimeZone,
  MELBOURNE,
  placeOf,
  radiusForPlace,
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

  it("plans a metro's suburbs: a box reaching its radius from the centre each way, carried in its place", () => {
    const tokyo = cityFromPlace("tokyo-jp", { ...TOKYO_PLACE, radiusKm: 15 });
    expect(tokyo.radiusKm).toBe(15);
    expect(isMetro(tokyo)).toBe(true);
    expect(tokyo.bbox.north - tokyo.bbox.south).toBeCloseTo(30 / 111.32, 3);
    expect(placeOf(tokyo)).toEqual({ ...TOKYO_PLACE, radiusKm: 15 });
    // No radius (an old link or request) is the CBD-sized box it always was, with no radius in its place.
    const old = cityFromPlace("tokyo-jp", TOKYO_PLACE);
    expect(old).toMatchObject({ radiusKm: DEFAULT_RADIUS_KM, bbox: cityFromPlace("tokyo-jp", { ...TOKYO_PLACE, radiusKm: DEFAULT_RADIUS_KM }).bbox });
    expect(isMetro(old)).toBe(false);
    expect(isMetro(MELBOURNE)).toBe(false);
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

describe("planning radius by the place's size", () => {
  it("grows with the population: 15 km past a million, 10 km past 250k, 6 km past 50k, else 3 km", () => {
    expect(radiusForPlace({ population: 2_700_000, featureCode: "PPL" })).toBe(15);
    expect(radiusForPlace({ population: 1_000_000, featureCode: "PPL" })).toBe(15);
    expect(radiusForPlace({ population: 441_000, featureCode: "PPL" })).toBe(10);
    expect(radiusForPlace({ population: 250_000, featureCode: "PPL" })).toBe(10);
    expect(radiusForPlace({ population: 80_000, featureCode: "PPL" })).toBe(6);
    expect(radiusForPlace({ population: 49_999, featureCode: "PPL" })).toBe(3);
    expect(radiusForPlace({})).toBe(DEFAULT_RADIUS_KM);
  });

  it("gives a capital at least 10 km and a region's seat at least 6 km, a neighbourhood 3 km", () => {
    expect(radiusForPlace({ population: 30_000, featureCode: "PPLC" })).toBe(10);
    expect(radiusForPlace({ featureCode: "PPLA" })).toBe(6);
    expect(radiusForPlace({ population: 441_000, featureCode: "PPLA" })).toBe(10);
    expect(radiusForPlace({ population: 3_000_000, featureCode: "PPLC" })).toBe(15);
    expect(radiusForPlace({ population: 500_000, featureCode: "PPLX" })).toBe(3);
  });

  it("refuses a radius out of range in a request's place", () => {
    const base = { city: "tokyo-jp", slot, performer };
    expect(planRequestSchema.safeParse({ ...base, place: { ...TOKYO_PLACE, radiusKm: 15 } }).success).toBe(true);
    expect(planRequestSchema.safeParse({ ...base, place: { ...TOKYO_PLACE, radiusKm: 500 } }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...base, place: { ...TOKYO_PLACE, radiusKm: 2.5 } }).success).toBe(false);
  });
});
