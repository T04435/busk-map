import { describe, expect, it } from "vitest";
import { fansCityOption } from "@/server/fans-city";

const OFFLINE = { offline: true, faults: [] };

describe("fansCityOption (offline, synthetic geocoder)", () => {
  it("resolves a fans city to the geocoded city at the marker", async () => {
    expect(await fansCityOption("Bogota~4.711~-74.0721", OFFLINE)).toMatchObject({ id: "bogota-bogota-d-c-co", name: "Bogota", country: "Colombia", timeZone: "America/Bogota" });
  });

  it("keeps Melbourne as the built-in city", async () => {
    expect(await fansCityOption("Melbourne~-37.8136~144.9631", OFFLINE)).toMatchObject({ id: "melbourne", timeZone: "Australia/Melbourne" });
  });

  it("is null for an unreadable link, a city the geocoder lacks or a marker far from the name", async () => {
    expect(await fansCityOption(undefined, OFFLINE)).toBeNull();
    expect(await fansCityOption("Bogota", OFFLINE)).toBeNull();
    expect(await fansCityOption("Zzzz~1~2", OFFLINE)).toBeNull();
    expect(await fansCityOption("Bogota~40~-74", OFFLINE)).toBeNull();
  });
});
