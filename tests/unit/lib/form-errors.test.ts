import { describe, expect, it } from "vitest";
import { fieldLabel, planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequestInput } from "@/lib/plan-schema";

const valid: PlanRequestInput = {
  city: "melbourne",
  slot: { date: "2026-10-24", startHour: 18, endHour: 21 },
  permit: "general",
  performer: { name: "My act", artists: ["Paul Kelly"], spotifyArtists: [], songs: [] },
};

function errorFor(input: PlanRequestInput): string {
  const result = planRequestSchema.safeParse(input);
  expect(result.success).toBe(false);
  return planFormError(result.error!.issues, input);
}

describe("planFormError (B-003)", () => {
  it("names the artist whose Spotify id fails, instead of a generic message", () => {
    const input = { ...valid, performer: { ...valid.performer, spotifyArtists: [{ name: "Buena Vista (synthetic)", id: "syn-artist-1" }] } };
    expect(errorFor(input)).toBe(
      "Artists you sound like: Busk Map can't use the Spotify id for Buena Vista (synthetic). Remove it and pick it again, or type the name.",
    );
  });

  it("keeps the artist and slot messages", () => {
    expect(errorFor({ ...valid, performer: { ...valid.performer, artists: [] } })).toBe("Add at least one artist you sound like.");
    expect(errorFor({ ...valid, slot: { ...valid.slot, endHour: 17 } })).toMatch(/^Check the date and times/);
  });

  it("names the song and the field otherwise", () => {
    const long = "x".repeat(130);
    expect(errorFor({ ...valid, performer: { ...valid.performer, songs: [{ title: long, artist: "A" }] } })).toMatch(/^Songs you can play: check “x+” \(/);
    expect(errorFor({ ...valid, performer: { ...valid.performer, songs: [{ title: "", artist: "A" }] } })).toMatch(/^Songs you can play: check song 1 \(/);
    expect(errorFor({ ...valid, performer: { ...valid.performer, name: "n".repeat(81) } })).toMatch(/^Act name: /);
    expect(errorFor({ ...valid, permit: "busker" as never })).toMatch(/^Permit: /);
    expect(planFormError([{ path: ["performer", "spotifyArtists", 3, "id"], message: "bad" }], valid)).toMatch(/Spotify id for an artist\./);
    expect(planFormError([{ path: ["city"], message: "Invalid option" }], valid)).toBe("Check the form and try again (city: Invalid option).");
    expect(planFormError([], valid)).toBe("Check the form and try again (request: invalid).");
  });

  it("maps schema paths to form labels", () => {
    expect(fieldLabel("performer.songs.2.title")).toBe("Songs you can play");
    expect(fieldLabel("performer.spotifyArtists")).toBe("Artists you sound like");
    expect(fieldLabel("performer.namez")).toBeNull();
  });
});
