import { describe, expect, it } from "vitest";
import { buttonGenreTag, GENRE_BUTTON_TAGS, normGenre, pickGenreTag, tagSlug } from "@/lib/qloo-match";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

/** Rows as the live /v2/tags returned them (media/qloo-coverage/raw/qloo), noisy names included. */
const INDIE_FOLK = [
  { id: "urn:tag:genre:music:indie_folk", name: "Indie - Folk" },
  { id: "urn:tag:genre:music:indie_folk_rock", name: "Indie Folk Rock" },
  { id: "urn:tag:genre:music:indie", name: '"indie"' },
  { id: "urn:tag:genre:music:folk", name: "Folk" },
  { id: "urn:tag:genre:music:indie_rock", name: "Indie - Rock" },
];
const SINGER = [
  { id: "urn:tag:genre:music:singersongwriter", name: "Singersongwriter" },
  { id: "urn:tag:genre:music:singer_songwriters", name: "Singer Songwriters" },
  { id: "urn:tag:genre:music:singer_songwritergdchill", name: "Singer-songwritergdchill" },
  { id: "urn:tag:genre:music:singer_songwriter", name: "Singer & Songwriter" },
];
const LATIN_POP = [
  { id: "urn:tag:genre:music:latin_pop", name: "Latin Pop" },
  { id: "urn:tag:genre:music:pop_latino", name: "Pop Latino" },
  { id: "urn:tag:genre:music:pop", name: "Pop" },
  { id: "urn:tag:genre:media:latin_american", name: "Latin american" },
];

describe("genre text normalising", () => {
  it("strips quotes, punctuation and case", () => {
    expect(normGenre('"indie"')).toBe("indie");
    expect(normGenre("Hip - Hop")).toBe("hip hop");
    expect(normGenre("Singer & Songwriter")).toBe("singer and songwriter");
    expect(tagSlug("urn:tag:genre:music:indie_folk")).toBe("indie folk");
  });
});

describe("pickGenreTag", () => {
  it("prefers an exact id slug or name over a partial match", () => {
    expect(pickGenreTag(INDIE_FOLK, "indie folk")?.id).toBe("urn:tag:genre:music:indie_folk");
    expect(pickGenreTag(INDIE_FOLK, "Folk")?.id).toBe("urn:tag:genre:music:folk");
    expect(pickGenreTag(INDIE_FOLK, "indie")?.id).toBe("urn:tag:genre:music:indie");
    expect(pickGenreTag(SINGER, "singer-songwriter")?.id).toBe("urn:tag:genre:music:singer_songwriter");
  });
  it("accepts Pop (the old overlap rule rejected it) and never a non-music tag", () => {
    expect(pickGenreTag(LATIN_POP, "Pop")?.id).toBe("urn:tag:genre:music:pop");
    expect(pickGenreTag(LATIN_POP, "latin")?.id).toBe("urn:tag:genre:music:latin_pop");
    expect(pickGenreTag([{ id: "urn:tag:genre:media:latin_american", name: "Latin american" }], "latin american")).toBeNull();
  });
  it("finds nothing for a text no tag has", () => {
    expect(pickGenreTag(INDIE_FOLK, "zydeco")).toBeNull();
    expect(pickGenreTag(INDIE_FOLK, "  ")).toBeNull();
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
