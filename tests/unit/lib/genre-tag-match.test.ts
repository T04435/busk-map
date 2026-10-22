import { describe, expect, it } from "vitest";
import { buttonGenreTag, GENRE_BUTTON_TAGS, normGenre, pickGenreTag, tagSlug } from "@/lib/qloo-match";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

/** Synthetic /v2/tags rows (made-up ids and names, in the shape Qloo returns), noisy names included. */
const ZORB = [
  { id: "urn:tag:genre:music:zorb_plink", name: "Zorb - Plink" },
  { id: "urn:tag:genre:music:zorb_plink_rock", name: "Zorb Plink Rock" },
  { id: "urn:tag:genre:music:zorb", name: '"zorb"' },
  { id: "urn:tag:genre:music:plink", name: "Plink" },
  { id: "urn:tag:genre:music:zorb_rock", name: "Zorb - Rock" },
];
const QUILL = [
  { id: "urn:tag:genre:music:quillsmith", name: "Quillsmith" },
  { id: "urn:tag:genre:music:quill_smiths", name: "Quill Smiths" },
  { id: "urn:tag:genre:music:quill_smithgdchill", name: "Quill-smithgdchill" },
  { id: "urn:tag:genre:music:quill_smith", name: "Quill & Smith" },
];
const GLIM = [
  { id: "urn:tag:genre:music:glim_pop", name: "Glim Pop" },
  { id: "urn:tag:genre:music:pop_glim", name: "Pop Glim" },
  { id: "urn:tag:genre:music:example_pop", name: "Example Pop" },
  { id: "urn:tag:genre:media:glim_american", name: "Glim american" },
];

describe("genre text normalising", () => {
  it("strips quotes, punctuation and case", () => {
    expect(normGenre('"zorb"')).toBe("zorb");
    expect(normGenre("Hip - Hop")).toBe("hip hop");
    expect(normGenre("Quill & Smith")).toBe("quill and smith");
    expect(tagSlug("urn:tag:genre:music:zorb_plink")).toBe("zorb plink");
  });
});

describe("pickGenreTag", () => {
  it("prefers an exact id slug or name over a partial match", () => {
    expect(pickGenreTag(ZORB, "zorb plink")?.id).toBe("urn:tag:genre:music:zorb_plink");
    expect(pickGenreTag(ZORB, "Plink")?.id).toBe("urn:tag:genre:music:plink");
    expect(pickGenreTag(ZORB, "zorb")?.id).toBe("urn:tag:genre:music:zorb");
    expect(pickGenreTag(QUILL, "quill-smith")?.id).toBe("urn:tag:genre:music:quill_smith");
  });
  it("accepts Pop (the old overlap rule rejected it) and never a non-music tag", () => {
    expect(pickGenreTag(GLIM, "example pop")?.id).toBe("urn:tag:genre:music:example_pop");
    expect(pickGenreTag(GLIM, "glim")?.id).toBe("urn:tag:genre:music:glim_pop");
    expect(pickGenreTag([{ id: "urn:tag:genre:media:glim_american", name: "Glim american" }], "glim american")).toBeNull();
  });
  it("finds nothing for a text no tag has", () => {
    expect(pickGenreTag(ZORB, "zydeco")).toBeNull();
    expect(pickGenreTag(ZORB, "  ")).toBeNull();
  });
});

describe("the genre buttons", () => {
  it("map straight to Qloo ids, case and spacing aside", () => {
    expect(buttonGenreTag("Pop")).toEqual({ id: "urn:tag:genre:music:pop", name: "Pop" });
    expect(buttonGenreTag("Hip hop")).toEqual({ id: "urn:tag:genre:music:hip_hop", name: "Hip Hop" });
    expect(buttonGenreTag("zydeco")).toBeNull();
    for (const id of Object.values(GENRE_BUTTON_TAGS)) expect(id).toMatch(/^urn:tag:genre:music:[a-z_]+$/);
  });
  it("every button is either mapped or left to the search (Latin, Country, Classical)", () => {
    const unmapped = PLAYLIST_COPY.research.genrePick.options.filter((g) => !buttonGenreTag(g));
    expect(unmapped).toEqual(["Latin", "Country", "Classical"]);
  });
});

describe("resolveGenreTag against the offline mock (noisy tag names, as live)", () => {
  const OFF = { offline: true, faults: [] } as const;
  it("a typed genre is matched by id slug through quoted and dashed names; buttons never search", async () => {
    const { resolveGenreTag } = await import("@/server/playlist/own-artist");
    expect(await resolveGenreTag("indie", OFF)).toEqual({ id: "urn:tag:genre:music:indie", name: "indie" });
    expect(await resolveGenreTag("hip-hop", OFF)).toEqual({ id: "urn:tag:genre:music:hip_hop", name: "Hip Hop" });
    expect(await resolveGenreTag("indie folk", OFF)).toEqual({ id: "urn:tag:genre:music:indie_folk", name: "Indie Folk" });
    expect(await resolveGenreTag("singer-songwriter", OFF)).toMatchObject({ id: "urn:tag:genre:music:singer_songwriter" });
    expect(await resolveGenreTag("Pop", OFF)).toEqual({ id: "urn:tag:genre:music:pop", name: "Pop" });
    expect(await resolveGenreTag("Latin", OFF)).toBeNull();
  });
});
