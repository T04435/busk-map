import { describe, expect, it } from "vitest";
import { suburbOf, suburbsOfPlaces } from "@/lib/venue";

describe("suburbs from Qloo place addresses", () => {
  it("reads the part after the street, without state, postcode or country", () => {
    expect(suburbOf("12 Crown St, Surry Hills NSW 2010, Australia")).toBe("Surry Hills");
    expect(suburbOf("Shop 3, 1 Bondi Rd, Bondi Junction NSW 2022")).toBe("Bondi Junction");
    expect(suburbOf("455 George St, Sydney NSW 2000, Australia")).toBe("Sydney");
    expect(suburbOf("Rua Augusta 10, 1100-053 Lisboa, Portugal")).toBe("Lisboa");
    expect(suburbOf("1 Synthetic Lane, Synthetic Shibuya 100-0000, Japan")).toBe("Synthetic Shibuya");
    expect(suburbOf("Somewhere")).toBeNull();
    expect(suburbOf(null)).toBeNull();
  });

  it("groups places by suburb at their centre, most places first", () => {
    const out = suburbsOfPlaces([
      { lat: -33.88, lon: 151.21, address: "1 Crown St, Surry Hills NSW 2010" },
      { lat: -33.89, lon: 151.21, address: "9 Bourke St, Surry Hills NSW 2010" },
      { lat: -33.87, lon: 151.2, address: "455 George St, Sydney NSW 2000" },
      { lat: -33.8, lon: 151.1, address: null },
    ]);
    expect(out.map((s) => [s.name, s.count])).toEqual([["Surry Hills", 2], ["Sydney", 1]]);
    expect(out[0].lat).toBeCloseTo(-33.885);
  });
});
