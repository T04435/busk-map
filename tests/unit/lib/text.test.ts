import { describe, expect, it } from "vitest";
import { nameKey, songKey, titleCase } from "@/lib/text";

describe("titleCase", () => {
  it("capitalises lowercase genre names from Qloo and leaves cased ones alone", () => {
    expect(titleCase("indie")).toBe("Indie");
    expect(titleCase(" indie ")).toBe("Indie");
    expect(titleCase("Alternative Rock")).toBe("Alternative Rock");
    expect(titleCase("alternative rock")).toBe("Alternative Rock");
    expect(titleCase("R&B")).toBe("R&B");
    expect(titleCase("hip-hop")).toBe("Hip-Hop");
    expect(titleCase("singer/songwriter")).toBe("Singer/Songwriter");
    expect(titleCase("rhythm and blues")).toBe("Rhythm and Blues");
    expect(titleCase("and more")).toBe("And More");
    expect(titleCase("UK garage")).toBe("UK Garage");
    expect(titleCase("")).toBe("");
  });
});

describe("keys", () => {
  it("collapse case, a leading 'The' and version suffixes", () => {
    expect(nameKey("The Paper Kites")).toBe(nameKey("paper kites"));
    expect(songKey("Superstition - Remastered 2000")).toBe("superstition");
  });
});
