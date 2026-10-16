import { describe, expect, it } from "vitest";
import { genresParam, parseGenresParam, parseOwnParam, ownParam } from "@/lib/performer-url";
import { parsePlanParams, planSearchParams } from "@/lib/plan-url";
import { planRequestSchema } from "@/lib/plan-schema";

const NOW = { today: "2026-10-14", hour: 9 };
const OWN = { qlooId: "4D4F434B-7923-F70E-1AC1-F5B56C8CBF9F", name: "The Bamboos", spotifyId: "snwFCxUDsBtAVsNCpizAkh" };
const base = { city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: { name: "Act", artists: ["Paul Kelly"] } };

describe("own artist in the plan URL", () => {
  it("round-trips through own=<qlooId>~<name>~<spotify id>", () => {
    const request = planRequestSchema.parse({ ...base, performer: { ...base.performer, ownArtist: OWN } });
    const params = planSearchParams(request);
    expect(params.get("own")).toBe(`${OWN.qlooId}~The Bamboos~${OWN.spotifyId}`);
    const parsed = parsePlanParams(Object.fromEntries(params), NOW);
    expect(parsed.ok && parsed.request.performer.ownArtist).toEqual(OWN);
  });

  it("works without the Spotify id and leaves old links alone", () => {
    expect(parseOwnParam(`${OWN.qlooId}~The Bamboos`)).toEqual({ ownArtist: { qlooId: OWN.qlooId, name: "The Bamboos" } });
    expect(parseOwnParam(undefined)).toEqual({});
    expect(parseOwnParam("bad id~Name")).toEqual({});
    expect(parseOwnParam(`${OWN.qlooId}~`)).toEqual({});
    const request = planRequestSchema.parse(base);
    expect(planSearchParams(request).has("own")).toBe(false);
    expect(ownParam(request.performer)).toEqual([]);
    const parsed = parsePlanParams(Object.fromEntries(planSearchParams(request)), NOW);
    expect(parsed.ok && "ownArtist" in parsed.request.performer).toBe(false);
  });

  it("keeps a name with a tilde parseable", () => {
    const request = planRequestSchema.parse({ ...base, performer: { ...base.performer, ownArtist: { qlooId: OWN.qlooId, name: "A~B" } } });
    const parsed = parsePlanParams(Object.fromEntries(planSearchParams(request)), NOW);
    expect(parsed.ok && parsed.request.performer.ownArtist?.name).toBe("A B");
  });
});

describe("genre tags in the plan URL (Repertoire research)", () => {
  const TAGS = [{ id: "urn:tag:genre:music:indie_folk", name: "Indie Folk" }, { id: "urn:tag:genre:music:singer_songwriter", name: "Singer-Songwriter" }];

  it("round-trips through genres=<id>~<name>|…", () => {
    const request = planRequestSchema.parse({ ...base, performer: { ...base.performer, genreTags: TAGS } });
    const params = planSearchParams(request);
    expect(params.get("genres")).toBe("urn:tag:genre:music:indie_folk~Indie Folk|urn:tag:genre:music:singer_songwriter~Singer-Songwriter");
    const parsed = parsePlanParams(Object.fromEntries(params), NOW);
    expect(parsed.ok && parsed.request.performer.genreTags).toEqual(TAGS);
  });

  it("leaves old links alone and drops what isn't a tag", () => {
    const request = planRequestSchema.parse(base);
    expect(genresParam(request.performer)).toEqual([]);
    expect(planSearchParams(request).has("genres")).toBe(false);
    expect(parseGenresParam(undefined)).toEqual({});
    expect(parseGenresParam("nope~Rock|urn:tag:genre:music:rock~")).toEqual({});
    expect(genresParam({ genreTags: [{ id: "urn:tag:genre:music:x", name: "A|B~C" }] })).toEqual([["genres", "urn:tag:genre:music:x~A B C"]]);
  });
});
